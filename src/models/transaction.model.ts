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
  conversionRate?: number;           // Exchange rate used (deprecated, usar usdRate)
  conversionSource?: 'api' | 'cache' | 'manual';  // Source of conversion
  conversionDate?: Date;             // When conversion was done
  manualConversion?: boolean;        // Whether user manually set the converted amount

  // USD-based exchange rate (ALWAYS relative to 1 USD)
  usdRate?: number;                  // Tasa respecto al USD: X currency = 1 USD (ej: 1050 ARS = 1 USD)
}

export type TransactionType = Transaction['type'];

