import { detectRecurringCandidates } from './recurring-detection.util';
import { Transaction } from '../types/transaction.types';
import { Bill } from '../types/bill.types';

function txn(overrides: Partial<Transaction> & { id: string; date: Date }): Transaction {
  return {
    categoryId: 'cat-1',
    type: 'expense',
    name: 'Netflix',
    description: '',
    amount: 1000,
    createdAt: overrides.date,
    updatedAt: overrides.date,
    ...overrides
  };
}

function bill(overrides: Partial<Bill> = {}): Bill {
  return {
    id: 'bill-1',
    name: 'Netflix',
    description: '',
    categoryId: 'cat-1',
    approxAmount: 1000,
    period: 'monthly',
    dueDate: new Date(2026, 0, 1),
    active: true,
    payments: [],
    createdAt: new Date(2026, 0, 1),
    updatedAt: new Date(2026, 0, 1),
    ...overrides
  };
}

/** Monthly-spaced dates, most recent = `now`, going back `count - 1` months. */
function monthlyDates(now: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, i) => new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), now.getDate()));
}

describe('detectRecurringCandidates', () => {
  const now = new Date(2026, 5, 15);

  it('detects a clean monthly pattern with consistent amounts', () => {
    const dates = monthlyDates(now, 4);
    const transactions = dates.map((date, i) => txn({ id: `t-${i}`, date, amount: 1000 + i }));

    const candidates = detectRecurringCandidates(transactions, [], now);

    expect(candidates.length).toBe(1);
    expect(candidates[0].categoryId).toBe('cat-1');
    expect(candidates[0].occurrences).toBe(4);
  });

  it('ignores groups with fewer than 3 occurrences', () => {
    const dates = monthlyDates(now, 2);
    const transactions = dates.map((date, i) => txn({ id: `t-${i}`, date }));

    expect(detectRecurringCandidates(transactions, [], now)).toEqual([]);
  });

  it('ignores groups with irregular spacing', () => {
    const transactions = [
      txn({ id: 't-1', date: new Date(2026, 0, 1) }),
      txn({ id: 't-2', date: new Date(2026, 0, 5) }),
      txn({ id: 't-3', date: new Date(2026, 4, 20) }),
      txn({ id: 't-4', date: new Date(2026, 5, 1) })
    ];

    expect(detectRecurringCandidates(transactions, [], now)).toEqual([]);
  });

  it('ignores groups with an amount outlier', () => {
    const dates = monthlyDates(now, 4);
    const transactions = dates.map((date, i) => txn({ id: `t-${i}`, date, amount: i === 0 ? 5000 : 1000 }));

    expect(detectRecurringCandidates(transactions, [], now)).toEqual([]);
  });

  it('excludes a group already covered by a matching active bill', () => {
    const dates = monthlyDates(now, 4);
    const transactions = dates.map((date, i) => txn({ id: `t-${i}`, date, amount: 1000 }));
    const bills = [bill({ categoryId: 'cat-1', approxAmount: 1000, active: true })];

    expect(detectRecurringCandidates(transactions, bills, now)).toEqual([]);
  });

  it('does not exclude a group when the matching bill is inactive', () => {
    const dates = monthlyDates(now, 4);
    const transactions = dates.map((date, i) => txn({ id: `t-${i}`, date, amount: 1000 }));
    const bills = [bill({ categoryId: 'cat-1', approxAmount: 1000, active: false })];

    expect(detectRecurringCandidates(transactions, bills, now).length).toBe(1);
  });
});
