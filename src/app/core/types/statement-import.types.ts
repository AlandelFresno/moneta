import { TransactionType } from './transaction.types';

export type StatementSource = 'santander' | 'lemon' | 'mercadopago';

export interface ParsedStatementRow {
  rowId: string;
  date: Date;
  name: string;
  description: string;
  amount: number;
  type: TransactionType;
  suggestedCategoryId?: string;
  categoryId: string;
  accountId: string;
  billId?: string;
  isDuplicate: boolean;
  include: boolean;
}

export interface StatementParseResult {
  source: StatementSource;
  rows: ParsedStatementRow[];
  errors: string[];
}
