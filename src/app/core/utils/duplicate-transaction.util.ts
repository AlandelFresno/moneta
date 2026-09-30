import { Transaction } from '../types/transaction.types';

/** Same name + same amount + same calendar day as an existing transaction. */
export function isDuplicateTransaction(
  candidate: Pick<Transaction, 'name' | 'amount' | 'date'>,
  existing: Transaction[]
): boolean {
  return existing.some(
    (txn) => txn.name === candidate.name && txn.amount === candidate.amount && isSameDay(txn.date, candidate.date)
  );
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
