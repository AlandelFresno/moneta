import { dedupeCategories } from './category-dedupe.util';
import { Category } from '../types/category.types';
import { Transaction } from '../types/transaction.types';
import { Bill } from '../types/bill.types';
import { Budget } from '../types/budget.types';

function category(overrides: Partial<Category> & { id: string; name: string; type: 'income' | 'expense' }): Category {
  return {
    color: '#10b981',
    icon: 'tag',
    createdAt: new Date(2026, 0, 1),
    updatedAt: new Date(2026, 0, 1),
    ...overrides
  };
}

function transaction(id: string, categoryId: string): Transaction {
  return {
    id,
    categoryId,
    type: 'expense',
    name: 't',
    description: '',
    amount: 100,
    date: new Date(2026, 0, 1),
    createdAt: new Date(2026, 0, 1),
    updatedAt: new Date(2026, 0, 1)
  };
}

function budget(id: string, categoryId: string): Budget {
  return {
    id,
    month: new Date(2026, 0, 1),
    totalAmount: 1000,
    allocations: [{ categoryId, amount: 500 }],
    goalAllocations: [],
    createdAt: new Date(2026, 0, 1),
    updatedAt: new Date(2026, 0, 1)
  };
}

function bill(id: string, categoryId: string): Bill {
  return {
    id,
    name: 'b',
    description: '',
    categoryId,
    approxAmount: 100,
    period: 'monthly',
    dueDate: new Date(2026, 0, 1),
    active: true,
    payments: [],
    createdAt: new Date(2026, 0, 1),
    updatedAt: new Date(2026, 0, 1)
  };
}

describe('dedupeCategories', () => {
  it('does nothing when there are no name+type collisions', () => {
    const categories = [
      category({ id: 'a', name: 'Salario', type: 'income' }),
      category({ id: 'b', name: 'Almacén', type: 'expense' })
    ];
    const result = dedupeCategories(categories, [], [], [], new Date(2026, 1, 1));

    expect(result.duplicatesRemoved).toBe(0);
    expect(result.categories).toEqual(categories);
  });

  it('collapses two categories with the same name+type, keeping the oldest as survivor', () => {
    const now = new Date(2026, 1, 1);
    const categories = [
      category({ id: 'random-1', name: 'Salario', type: 'income', createdAt: new Date(2026, 0, 1) }),
      category({ id: 'seed-income-default', name: 'Salario', type: 'income', createdAt: new Date(2025, 11, 1) })
    ];

    const result = dedupeCategories(categories, [], [], [], now);

    expect(result.duplicatesRemoved).toBe(1);
    const survivor = result.categories.find((c) => c.id === 'seed-income-default')!;
    const duplicate = result.categories.find((c) => c.id === 'random-1')!;
    expect(survivor.deletedAt).toBeUndefined();
    expect(duplicate.deletedAt).toEqual(now);
  });

  it('repoints transactions and bills from the duplicate id to the survivor id', () => {
    const now = new Date(2026, 1, 1);
    const categories = [
      category({ id: 'random-1', name: 'Almacén', type: 'expense', createdAt: new Date(2026, 0, 5) }),
      category({ id: 'seed-expense-default', name: 'Almacén', type: 'expense', createdAt: new Date(2025, 11, 1) })
    ];
    const transactions = [transaction('t1', 'random-1'), transaction('t2', 'seed-expense-default')];
    const bills = [bill('b1', 'random-1')];
    const budgets = [budget('bg1', 'random-1')];

    const result = dedupeCategories(categories, transactions, bills, budgets, now);

    expect(result.transactions.find((t) => t.id === 't1')!.categoryId).toBe('seed-expense-default');
    expect(result.transactions.find((t) => t.id === 't2')!.categoryId).toBe('seed-expense-default');
    expect(result.bills.find((b) => b.id === 'b1')!.categoryId).toBe('seed-expense-default');
    expect(result.budgets.find((b) => b.id === 'bg1')!.allocations[0].categoryId).toBe('seed-expense-default');
  });

  it('does not touch soft-deleted categories when checking for collisions', () => {
    const now = new Date(2026, 1, 1);
    const categories = [
      category({ id: 'a', name: 'Salario', type: 'income' }),
      category({ id: 'b', name: 'Salario', type: 'income', deletedAt: new Date(2026, 0, 15) })
    ];

    const result = dedupeCategories(categories, [], [], [], now);
    expect(result.duplicatesRemoved).toBe(0);
  });
});
