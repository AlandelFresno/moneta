import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { DashboardService } from './dashboard.service';
import { Transaction } from '../core/types/transaction.types';
import { Category } from '../core/types/category.types';

const CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Almacén', type: 'expense', color: '#f00', icon: 'tag', createdAt: new Date(), updatedAt: new Date() },
  { id: 'cat-2', name: 'Salario', type: 'income', color: '#0f0', icon: 'tag', createdAt: new Date(), updatedAt: new Date() }
];

function txn(overrides: Partial<Transaction>): Transaction {
  return {
    id: Math.random().toString(),
    categoryId: 'cat-1',
    type: 'expense',
    name: 'x',
    description: '',
    amount: 100,
    date: new Date(2026, 0, 15),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    service = TestBed.inject(DashboardService);
  });

  it('filters transactions to a given year/month', () => {
    const transactions = [
      txn({ date: new Date(2026, 0, 15) }),
      txn({ date: new Date(2026, 1, 1) })
    ];

    const result = service.transactionsInMonth(transactions, 2026, 0);
    expect(result.length).toBe(1);
  });

  it('breaks down totals by category for a given type', () => {
    const transactions = [
      txn({ categoryId: 'cat-1', type: 'expense', amount: 100 }),
      txn({ categoryId: 'cat-1', type: 'expense', amount: 50 }),
      txn({ categoryId: 'cat-2', type: 'income', amount: 1000 })
    ];

    const result = service.categoryBreakdown(transactions, CATEGORIES, 'expense');
    expect(result.length).toBe(1);
    expect(result[0].total).toBe(150);
    expect(result[0].categoryName).toBe('Almacén');
  });

  it('sorts category breakdown descending by total', () => {
    const transactions = [
      txn({ categoryId: 'cat-1', type: 'expense', amount: 50 }),
      txn({ categoryId: 'cat-3', type: 'expense', amount: 200 })
    ];
    const categories = [...CATEGORIES, { id: 'cat-3', name: 'Ocio', type: 'expense' as const, color: '#00f', icon: 'tag', createdAt: new Date(), updatedAt: new Date() }];

    const result = service.categoryBreakdown(transactions, categories, 'expense');
    expect(result[0].categoryName).toBe('Ocio');
    expect(result[1].categoryName).toBe('Almacén');
  });

  it('builds a monthly trend for the requested number of months', () => {
    const transactions = [
      txn({ type: 'income', amount: 1000, date: new Date(2026, 0, 10) }),
      txn({ type: 'expense', amount: 300, date: new Date(2026, 0, 20) }),
      txn({ type: 'expense', amount: 100, date: new Date(2025, 11, 5) })
    ];

    const result = service.monthlyTrend(transactions, 3, new Date(2026, 0, 15));

    expect(result.length).toBe(3);
    const january = result[result.length - 1];
    expect(january.income).toBe(1000);
    expect(january.expense).toBe(300);

    const december = result[result.length - 2];
    expect(december.expense).toBe(100);
  });
});
