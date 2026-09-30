import { Injectable } from '@angular/core';
import { ParsedStatementRow, StatementParseResult } from '../core/types/statement-import.types';
import { parseArsAmount } from '../core/utils/currency-parse.util';
import { generateStatementRowId } from '../core/utils/statement-row-id.util';

const DATE_PREFIX = /^\s*(\d{2})\/(\d{2})\/(\d{2})\b/;
const MONEY_TOKEN = /-?\$\s?[\d.]+,\d{2}/g;
const LEADING_RECEIPT_NUMBER = /^\s*\d{4,}\s*/;
const CONTINUATION_STOP = /comprobante|^\s*fecha\b|^movimientos/i;

@Injectable({
  providedIn: 'root'
})
export class SantanderPdfParserService {
  parseLines(lines: string[]): StatementParseResult {
    const rows: ParsedStatementRow[] = [];
    const errors: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const dateMatch = line.match(DATE_PREFIX);
      if (!dateMatch) continue;

      const moneyTokens = line.match(MONEY_TOKEN) ?? [];
      // A real movement row has exactly one amount + the running balance. Other token counts
      // are opening-balance rows (both account columns filled) or unrelated tables further down
      // the statement (e.g. the installment-purchase detail list) — not ledger movements.
      if (moneyTokens.length !== 2) continue;

      const amount = parseArsAmount(moneyTokens[0]);
      if (amount === 0) continue;

      let description = line
        .replace(DATE_PREFIX, '')
        .split(MONEY_TOKEN)[0]
        .replace(LEADING_RECEIPT_NUMBER, '')
        .trim();

      const next = lines[i + 1] ?? '';
      if (next.trim() && !DATE_PREFIX.test(next) && !CONTINUATION_STOP.test(next)) {
        description = description ? `${description} - ${next.trim()}` : next.trim();
        i++;
      }

      if (!description) description = 'Movimiento Santander';

      rows.push({
        rowId: generateStatementRowId(),
        date: this.parseDate(dateMatch),
        name: description.length > 80 ? description.slice(0, 80) : description,
        description,
        amount: Math.abs(amount),
        type: amount >= 0 ? 'income' : 'expense',
        categoryId: '',
        accountId: '',
        isDuplicate: false,
        include: true
      });
    }

    return { source: 'santander', rows, errors };
  }

  private parseDate(match: RegExpMatchArray): Date {
    const [, day, month, year] = match;
    return new Date(2000 + Number(year), Number(month) - 1, Number(day));
  }
}
