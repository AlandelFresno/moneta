import { Injectable } from '@angular/core';
import { ParsedStatementRow, StatementParseResult } from '../core/types/statement-import.types';
import { TransactionType } from '../core/types/transaction.types';
import { parseUsStyleAmount } from '../core/utils/currency-parse.util';
import { generateStatementRowId } from '../core/utils/statement-row-id.util';

// Row text collapses to single-spaced columns once reconstructed from PDF glyph positions
// (no reliable multi-space column gaps to split on), so rows are matched by content instead
// of position: "<DETALLE> [ESTADO] <COMERCIO> <FECHA HORA> [códigos...] $ <MONTO TOTAL> ...".
const ROW_START = /^(Compra con Tarjeta|Devoluci[oó]n de Compra)\s+/i;
const LEADING_STATUS = /^(Confirmada|Aprobada|Rechazada|Pendiente)\s+/i;
const DATE_TIME = /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/;
const AMOUNT = /\$\s?[\d,]+\.\d{2}/;

@Injectable({
  providedIn: 'root'
})
export class LemonPdfParserService {
  parseLines(lines: string[]): StatementParseResult {
    const rows: ParsedStatementRow[] = [];

    for (const line of lines) {
      const startMatch = line.match(ROW_START);
      if (!startMatch) continue;

      const detalle = startMatch[1];
      const type: TransactionType = detalle.toLowerCase().startsWith('compra') ? 'expense' : 'income';

      const rest = line.slice(startMatch[0].length).replace(LEADING_STATUS, '');
      const dateMatch = rest.match(DATE_TIME);
      if (!dateMatch || dateMatch.index === undefined) continue;

      const merchant = rest.slice(0, dateMatch.index).trim();
      const afterDate = rest.slice(dateMatch.index + dateMatch[0].length);
      const amountMatch = afterDate.match(AMOUNT);
      if (!merchant || !amountMatch) continue;

      rows.push({
        rowId: generateStatementRowId(),
        date: this.parseDate(dateMatch),
        name: merchant,
        description: detalle,
        amount: Math.abs(parseUsStyleAmount(amountMatch[0])),
        type,
        categoryId: '',
        accountId: '',
        isDuplicate: false,
        include: true
      });
    }

    return { source: 'lemon', rows, errors: [] };
  }

  private parseDate(match: RegExpMatchArray): Date {
    const [, day, month, year, hour, minute] = match;
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  }
}
