import { suggestCategoryId } from './category-suggestion.util';
import { Transaction } from '../types/transaction.types';

function txn(overrides: Partial<Transaction> & { id: string; date: Date; categoryId: string }): Transaction {
  return {
    type: 'expense',
    name: 'Supermercado',
    description: '',
    amount: 100,
    createdAt: overrides.date,
    updatedAt: overrides.date,
    ...overrides
  };
}

const NOW = new Date(2026, 5, 15);

describe('suggestCategoryId', () => {
  it('returns undefined for an empty description', () => {
    expect(suggestCategoryId('', [], NOW)).toBeUndefined();
  });

  it('returns undefined when nothing in history matches', () => {
    const history = [txn({ id: 't1', categoryId: 'cat-1', name: 'Farmacia', date: NOW })];
    expect(suggestCategoryId('Nafta YPF', history, NOW)).toBeUndefined();
  });

  it('matches when the past transaction name is a substring of the description', () => {
    const history = [txn({ id: 't1', categoryId: 'cat-food', name: 'Supermercado', date: NOW })];
    expect(suggestCategoryId('Compra con tarjeta de debito - Supermercado - tarj nro. 1089', history, NOW)).toBe('cat-food');
  });

  it('matches when the description is a substring of a past transaction name', () => {
    const history = [txn({ id: 't1', categoryId: 'cat-food', name: 'Supermercado La Esquina', date: NOW })];
    expect(suggestCategoryId('Supermercado', history, NOW)).toBe('cat-food');
  });

  it('ignores soft-deleted transactions', () => {
    const history = [txn({ id: 't1', categoryId: 'cat-food', name: 'Farmacia', date: NOW, deletedAt: NOW })];
    expect(suggestCategoryId('Farmacia', history, NOW)).toBeUndefined();
  });

  it('picks the category with more recent matches over one with more but older matches', () => {
    const longAgo = new Date(2024, 0, 1); // ~2.5 years before NOW
    const lastWeek = new Date(2026, 5, 8);
    const history = [
      txn({ id: 't1', categoryId: 'cat-old', name: 'Farmacia', date: longAgo }),
      txn({ id: 't2', categoryId: 'cat-old', name: 'Farmacia', date: longAgo }),
      txn({ id: 't3', categoryId: 'cat-old', name: 'Farmacia', date: longAgo }),
      txn({ id: 't4', categoryId: 'cat-new', name: 'Farmacia', date: lastWeek })
    ];

    expect(suggestCategoryId('Farmacia', history, NOW)).toBe('cat-new');
  });

  it('picks the category with more matches when recency is equal', () => {
    const history = [
      txn({ id: 't1', categoryId: 'cat-a', name: 'Kiosco', date: NOW }),
      txn({ id: 't2', categoryId: 'cat-a', name: 'Kiosco', date: NOW }),
      txn({ id: 't3', categoryId: 'cat-b', name: 'Kiosco', date: NOW })
    ];

    expect(suggestCategoryId('Kiosco', history, NOW)).toBe('cat-a');
  });
});
