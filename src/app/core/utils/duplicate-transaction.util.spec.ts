import { isDuplicateTransaction } from './duplicate-transaction.util';
import { Transaction } from '../types/transaction.types';

function txn(overrides: Partial<Transaction> & { id: string }): Transaction {
  return {
    categoryId: 'cat-1',
    type: 'expense',
    name: 'Supermercado',
    description: '',
    amount: 100,
    date: new Date(2026, 0, 15),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

describe('isDuplicateTransaction', () => {
  it('matches when name, amount, and calendar day all match', () => {
    const existing = [txn({ id: 't1' })];
    const candidate = { name: 'Supermercado', amount: 100, date: new Date(2026, 0, 15) };

    expect(isDuplicateTransaction(candidate, existing)).toBeTrue();
  });

  it('ignores time-of-day — same calendar day still matches', () => {
    const existing = [txn({ id: 't1', date: new Date(2026, 0, 15, 23, 59) })];
    const candidate = { name: 'Supermercado', amount: 100, date: new Date(2026, 0, 15, 0, 1) };

    expect(isDuplicateTransaction(candidate, existing)).toBeTrue();
  });

  it('does not match when the amount differs', () => {
    const existing = [txn({ id: 't1' })];
    const candidate = { name: 'Supermercado', amount: 999, date: new Date(2026, 0, 15) };

    expect(isDuplicateTransaction(candidate, existing)).toBeFalse();
  });

  it('does not match when the name differs', () => {
    const existing = [txn({ id: 't1' })];
    const candidate = { name: 'Otro', amount: 100, date: new Date(2026, 0, 15) };

    expect(isDuplicateTransaction(candidate, existing)).toBeFalse();
  });

  it('does not match when the date is a different day', () => {
    const existing = [txn({ id: 't1' })];
    const candidate = { name: 'Supermercado', amount: 100, date: new Date(2026, 0, 16) };

    expect(isDuplicateTransaction(candidate, existing)).toBeFalse();
  });

  it('returns false against an empty history', () => {
    const candidate = { name: 'Supermercado', amount: 100, date: new Date(2026, 0, 15) };

    expect(isDuplicateTransaction(candidate, [])).toBeFalse();
  });
});
