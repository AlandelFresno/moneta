import { Injectable } from '@angular/core';
import { lastValueFrom } from 'rxjs';

import { ParsedStatementRow, StatementParseResult } from '../core/types/statement-import.types';
import { Transaction } from '../core/types/transaction.types';
import { extractLayoutLines } from '../core/utils/pdf-text-extraction.util';
import { readFileAsText } from '../core/utils/file-download.util';
import { isDuplicateTransaction } from '../core/utils/duplicate-transaction.util';
import { suggestCategoryId } from '../core/utils/category-suggestion.util';
import { SantanderPdfParserService } from './santander-pdf-parser.service';
import { LemonPdfParserService } from './lemon-pdf-parser.service';
import { MercadoPagoCsvParserService } from './mercadopago-csv-parser.service';
import { TransactionService } from './transaction.service';
import { BillService } from './bill.service';

@Injectable({
  providedIn: 'root'
})
export class StatementImportService {
  constructor(
    private readonly santanderParser: SantanderPdfParserService,
    private readonly lemonParser: LemonPdfParserService,
    private readonly mercadoPagoParser: MercadoPagoCsvParserService,
    private readonly transactionService: TransactionService,
    private readonly billService: BillService
  ) {}

  /** Reads the file and dispatches to the matching bank/CSV parser. Throws if the file's
   * extension or PDF content don't match any supported statement format. */
  async parseFile(file: File): Promise<StatementParseResult> {
    const name = file.name.toLowerCase();

    if (name.endsWith('.csv')) {
      const text = await readFileAsText(file);
      const lines = text.split('\n').map((line) => line.replace(/\r$/, ''));
      return this.mercadoPagoParser.parseLines(lines);
    }

    if (name.endsWith('.pdf')) {
      const lines = await this.withTimeout(extractLayoutLines(file), 'El PDF tardó demasiado en leerse.');
      const joined = lines.join(' ').toLowerCase();
      // Bare "lemon"/"santander" substrings are unreliable — a Santander transfer description
      // can legitimately contain "lemon" as a counterparty account nickname (e.g. "de alan mariano
      // del fresno / lemon /..."). Match each bank's own fixed boilerplate text instead.
      if (joined.includes('digifin s.a') || joined.includes('resumen lemon card')) {
        return this.lemonParser.parseLines(lines);
      }
      if (joined.includes('banco santander') || joined.includes('movimientos en pesos')) {
        return this.santanderParser.parseLines(lines);
      }
      throw new Error('No se pudo identificar el banco del PDF (se esperaba Santander o Lemon Card).');
    }

    throw new Error('Formato de archivo no soportado. Usá un CSV o PDF.');
  }

  /** Pre-fills a default account (still editable per row — statements can span several
   * accounts), flags duplicates against existing transactions, and suggests a category
   * from past transaction history. */
  annotate(result: StatementParseResult, existingTransactions: Transaction[], defaultAccountId: string): ParsedStatementRow[] {
    return result.rows.map((row) => {
      const suggestedCategoryId = suggestCategoryId(row.name, existingTransactions);
      const isDuplicate = isDuplicateTransaction(row, existingTransactions);

      return {
        ...row,
        accountId: defaultAccountId,
        categoryId: suggestedCategoryId ?? '',
        suggestedCategoryId,
        isDuplicate,
        include: !isDuplicate
      };
    });
  }

  /** Creates a real Transaction for every included, categorized row. Returns how many were created. */
  async commit(rows: ParsedStatementRow[]): Promise<number> {
    const toCommit = rows.filter((row) => row.include && row.categoryId);

    let created = 0;
    for (const row of toCommit) {
      if (await this.commitOne(row)) created++;
    }

    return created;
  }

  /** Creates a real Transaction for a single row, ignoring its `include` flag, and links it to
   * a Bill payment when `billId` is set. Returns false without creating anything if the row is
   * missing a category. Account is optional. */
  async commitOne(row: ParsedStatementRow): Promise<boolean> {
    if (!row.categoryId) return false;

    const transaction = await lastValueFrom(
      this.transactionService.create({
        categoryId: row.categoryId,
        accountId: row.accountId || undefined,
        type: row.type,
        name: row.name,
        description: row.description,
        amount: row.amount,
        date: row.date
      })
    );

    if (row.billId) {
      await lastValueFrom(this.billService.recordPayment(row.billId, row.amount, transaction.id, row.date));
    }

    return true;
  }

  private withTimeout<T>(promise: Promise<T>, message: string, ms = 20_000): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms))
    ]);
  }
}
