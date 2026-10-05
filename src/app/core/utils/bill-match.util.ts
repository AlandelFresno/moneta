import { Bill } from '../types/bill.types';
import { TransactionType } from '../types/transaction.types';

const MAX_AMOUNT_DEVIATION_RATIO = 0.25;

/** Suggests an active bill to link an expense row to: same category, amount within 25% of the
 * bill's approxAmount. Only returns a suggestion when exactly one bill qualifies — with several
 * equally-plausible candidates (e.g. two similarly-priced subscriptions in the same category),
 * guessing wrong is worse than leaving it for manual selection. */
export function suggestBillId(row: { categoryId: string; amount: number; type: TransactionType }, bills: Bill[]): string | undefined {
  if (row.type !== 'expense' || !row.categoryId) return undefined;

  const candidates = bills.filter(
    (bill) =>
      !bill.deletedAt &&
      bill.active &&
      bill.categoryId === row.categoryId &&
      bill.approxAmount > 0 &&
      Math.abs(bill.approxAmount - row.amount) / bill.approxAmount <= MAX_AMOUNT_DEVIATION_RATIO
  );

  return candidates.length === 1 ? candidates[0].id : undefined;
}
