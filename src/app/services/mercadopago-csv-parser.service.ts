import { Injectable } from '@angular/core';
import { ParsedStatementRow, StatementParseResult } from '../core/types/statement-import.types';
import { generateStatementRowId } from '../core/utils/statement-row-id.util';

const EXPECTED_HEADER = 'SOURCE_ID';

@Injectable({
  providedIn: 'root'
})
export class MercadoPagoCsvParserService {
  parseLines(lines: string[]): StatementParseResult {
    const nonEmpty = lines.filter((line) => line.trim());
    if (nonEmpty.length === 0 || !nonEmpty[0].startsWith(EXPECTED_HEADER)) {
      throw new Error('El archivo no tiene el formato esperado de un CSV de MercadoPago.');
    }

    const header = nonEmpty[0].split(';');
    const idx = {
      sourceId: header.indexOf('SOURCE_ID'),
      paymentMethodType: header.indexOf('PAYMENT_METHOD_TYPE'),
      transactionType: header.indexOf('TRANSACTION_TYPE'),
      transactionAmount: header.indexOf('TRANSACTION_AMOUNT'),
      transactionDate: header.indexOf('TRANSACTION_DATE'),
      businessUnit: header.indexOf('BUSINESS_UNIT'),
      subUnit: header.indexOf('SUB_UNIT')
    };

    const rows: ParsedStatementRow[] = [];
    const errors: string[] = [];

    for (const line of nonEmpty.slice(1)) {
      const cols = line.split(';');
      const amount = parseFloat(cols[idx.transactionAmount]);
      const date = new Date(cols[idx.transactionDate]);

      if (Number.isNaN(amount) || amount === 0 || Number.isNaN(date.getTime())) {
        errors.push(`No se pudo interpretar: ${line}`);
        continue;
      }

      const paymentMethodType = cols[idx.paymentMethodType]?.trim();
      const businessUnit = cols[idx.businessUnit]?.trim();
      const subUnit = cols[idx.subUnit]?.trim();
      const transactionType = cols[idx.transactionType]?.trim() || 'SETTLEMENT';
      const sourceId = cols[idx.sourceId]?.trim() ?? '';

      const name = paymentMethodType
        ? `MercadoPago (${paymentMethodType})`
        : businessUnit
          ? `MercadoPago (${businessUnit}${subUnit ? ' - ' + subUnit : ''})`
          : `MercadoPago ${transactionType}`;

      rows.push({
        rowId: generateStatementRowId(),
        date,
        name,
        description: `${transactionType} · ${sourceId}`,
        amount: Math.abs(amount),
        type: amount >= 0 ? 'income' : 'expense',
        categoryId: '',
        accountId: '',
        isDuplicate: false,
        include: true
      });
    }

    return { source: 'mercadopago', rows, errors };
  }
}
