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

  // Rate mode: how this transaction's currency conversion works
  // 'live'     — balance stays in native currency, converts at today's API rate
  // 'frozen'   — conversion happened at entry time, rate never changes
  // 'transfer' — internal move between accounts, excluded from income/expense stats
  rateMode?: 'live' | 'frozen' | 'transfer';

  // Links both legs of a Mode 3 transfer (same UUID on both records)
  transferGroupId?: string;

  // Frozen conversion data (only for rateMode 'frozen' or 'transfer' with currency exchange)
  convertedAmount?: number;          // Amount in preferred currency, frozen at entry time
  conversionSource?: 'api' | 'cache' | 'manual';
  usdRate?: number;                  // 1 fromCurrency = usdRate preferredCurrency (or X currency = 1 USD for non-preferred)

  // Snapshot of all rates at save time — used for display only, not stats
  exchangeRates?: {
    ARS: number;
    USD: number;
    EUR: number;
    BRL: number;
  };

  /** @deprecated use conversionSource instead */
  conversionRate?: number;

  deletedAt?: Date;
}

export type TransactionType = Transaction['type'];

/**
 * Resolves the effective rate mode for a transaction.
 * Handles legacy records that predate the rateMode field.
 */
export function resolveRateMode(t: Transaction): 'live' | 'frozen' | 'transfer' {
  if (t.rateMode) return t.rateMode;
  if (t.convertedAmount && t.convertedAmount > 0) return 'frozen';
  return 'live';
}
