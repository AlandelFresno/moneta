export interface Transaction {
  id: string;
  accountId: string;
  categoryId: string;
  type: 'income' | 'expense';
  amount: number;
  currency: string;
  description: string;
  date: Date;
  createdAt: Date;
  updatedAt: Date;

  // Conversion information
  convertedAmount?: number;          // Amount in preferred currency
  conversionRate?: number;           // Exchange rate used
  conversionSource?: 'api' | 'cache' | 'manual';  // Source of conversion
  conversionDate?: Date;             // When conversion was done
  manualConversion?: boolean;        // Whether user manually set the converted amount
}

export type TransactionType = Transaction['type'];

