import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { DashboardService } from './dashboard.service';
import { Transaction } from '../core/types/transaction.types';
import { Category } from '../core/types/category.types';
import { Account } from '../core/types/account.types';

function account(overrides: Partial<Account>): Account {
  return {
    id: Math.random().toString(),
    name: 'Cuenta',
    type: 'cash',
    balance: 0,
    color: '#3b82f6',
    icon: 'wallet',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

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

  describe('rangeForPreset', () => {
    it('resolves "thisMonth" to the full calendar month of the reference date at the default start day', () => {
      const range = service.rangeForPreset('thisMonth', new Date(2026, 1, 15), [], null, 1, 0);
      expect(range.start).toEqual(new Date(2026, 1, 1));
      expect(range.end).toEqual(new Date(2026, 1, 28, 23, 59, 59, 999));
    });

    it('resolves "thisMonth" to the custom period when a period start day is set', () => {
      // Paid the 6th of each month: the 1st-5th belong to the previous period.
      const range = service.rangeForPreset('thisMonth', new Date(2026, 7, 3), [], null, 6, 0);
      expect(range.start).toEqual(new Date(2026, 6, 6));
      expect(range.end).toEqual(new Date(new Date(2026, 7, 6).getTime() - 1));
    });

    it('resolves "thisMonth" using a marked transaction\'s exact timestamp instead of the default hour', () => {
      const marker = txn({ type: 'income', isPeriodStart: true, date: new Date(2026, 7, 6, 14, 32) });
      const range = service.rangeForPreset('thisMonth', new Date(2026, 7, 20), [marker], null, 6, 0);
      expect(range.start).toEqual(new Date(2026, 7, 6, 14, 32));
    });

    it('resolves "last3" to a 3-month window ending on the reference month', () => {
      const range = service.rangeForPreset('last3', new Date(2026, 2, 10), [], null, 1, 0);
      expect(range.start).toEqual(new Date(2026, 0, 1));
      expect(range.end).toEqual(new Date(2026, 2, 31));
    });

    it('resolves "thisYear" to Jan 1 - Dec 31 of the reference year', () => {
      const range = service.rangeForPreset('thisYear', new Date(2026, 5, 1), [], null, 1, 0);
      expect(range.start).toEqual(new Date(2026, 0, 1));
      expect(range.end).toEqual(new Date(2026, 11, 31));
    });

    it('resolves "allTime" to the min/max transaction dates', () => {
      const transactions = [txn({ date: new Date(2024, 3, 1) }), txn({ date: new Date(2026, 0, 20) })];
      const range = service.rangeForPreset('allTime', new Date(2026, 5, 1), transactions, null, 1, 0);
      expect(range.start).toEqual(new Date(2024, 3, 1));
      expect(range.end).toEqual(new Date(2026, 0, 20));
    });

    it('resolves "custom" to the provided range', () => {
      const custom = { start: new Date(2026, 0, 5), end: new Date(2026, 0, 10) };
      const range = service.rangeForPreset('custom', new Date(2026, 5, 1), [], custom, 1, 0);
      expect(range).toEqual(custom);
    });
  });

  describe('previousRange', () => {
    it('returns the immediately preceding period of the same duration', () => {
      const range = { start: new Date(2026, 1, 1), end: new Date(2026, 1, 28) };
      const previous = service.previousRange(range);
      expect(previous.end).toEqual(new Date(2026, 0, 31, 23, 59, 59, 999));
      expect(previous.start).toEqual(new Date(2026, 0, 4));
    });

    it('shifts back multiple periods when offset > 1', () => {
      const range = { start: new Date(2026, 1, 1), end: new Date(2026, 1, 28) };
      const twoBack = service.previousRange(range, 2);
      expect(twoBack.end).toEqual(new Date(2026, 0, 3, 23, 59, 59, 999));
      expect(twoBack.start).toEqual(new Date(2025, 11, 7));
    });
  });

  describe('transactionsInRange', () => {
    it('filters transactions to those within the inclusive date range', () => {
      const transactions = [
        txn({ date: new Date(2026, 0, 15) }),
        txn({ date: new Date(2026, 1, 1) }),
        txn({ date: new Date(2025, 11, 31) })
      ];

      const result = service.transactionsInRange(transactions, { start: new Date(2026, 0, 1), end: new Date(2026, 0, 31) });
      expect(result.length).toBe(1);
    });
  });

  describe('transactionsInPeriod', () => {
    it('matches exactly, without widening to whole days', () => {
      const transactions = [
        txn({ date: new Date(2026, 7, 6, 10, 0) }),
        txn({ date: new Date(2026, 7, 6, 14, 32) }),
        txn({ date: new Date(2026, 7, 6, 18, 0) })
      ];

      const result = service.transactionsInPeriod(transactions, {
        start: new Date(2026, 7, 6, 14, 32),
        end: new Date(2026, 7, 6, 23, 59, 59, 999)
      });

      expect(result.length).toBe(2);
      expect(result.every((t) => t.date.getTime() >= new Date(2026, 7, 6, 14, 32).getTime())).toBe(true);
    });
  });

  describe('categoryBreakdown', () => {
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
  });

  describe('monthlyTrendInRange', () => {
    it('builds a monthly trend spanning the given range', () => {
      const transactions = [
        txn({ type: 'income', amount: 1000, date: new Date(2026, 0, 10) }),
        txn({ type: 'expense', amount: 300, date: new Date(2026, 0, 20) }),
        txn({ type: 'expense', amount: 100, date: new Date(2025, 11, 5) })
      ];

      const result = service.monthlyTrendInRange(transactions, { start: new Date(2025, 11, 1), end: new Date(2026, 0, 31) });

      expect(result.length).toBe(2);
      expect(result[0].expense).toBe(100);
      expect(result[1].income).toBe(1000);
      expect(result[1].expense).toBe(300);
    });
  });

  describe('netWorthTrendInRange', () => {
    it('reconstructs each bucket end-of-period net worth backward from the current account totals', () => {
      const accounts = [account({ id: 'acc-1', balance: 1000 })];
      const transactions = [txn({ accountId: 'acc-1', type: 'income', amount: 500, date: new Date(2026, 0, 2) })];

      const result = service.netWorthTrendInRange(transactions, accounts, {
        start: new Date(2026, 0, 1),
        end: new Date(2026, 0, 3)
      });

      expect(result.map((p) => p.netWorth)).toEqual([500, 1000, 1000]);
    });

    it('ignores transactions with no accountId — they never moved any tracked balance', () => {
      const accounts = [account({ id: 'acc-1', balance: 1000 })];
      const transactions = [txn({ type: 'income', amount: 500, date: new Date(2026, 0, 2) })];

      const result = service.netWorthTrendInRange(transactions, accounts, {
        start: new Date(2026, 0, 1),
        end: new Date(2026, 0, 3)
      });

      expect(result.every((p) => p.netWorth === 1000)).toBeTrue();
    });
  });

  describe('periodStats', () => {
    it('computes totals, count, average, savings rate and biggest transactions', () => {
      const transactions = [
        txn({ type: 'income', amount: 1000 }),
        txn({ type: 'expense', amount: 200 }),
        txn({ type: 'expense', amount: 600 })
      ];

      const stats = service.periodStats(transactions);
      expect(stats.income).toBe(1000);
      expect(stats.expense).toBe(800);
      expect(stats.balance).toBe(200);
      expect(stats.transactionCount).toBe(3);
      expect(stats.avgTransaction).toBeCloseTo(600);
      expect(stats.savingsRate).toBeCloseTo(20);
      expect(stats.biggestExpense?.amount).toBe(600);
      expect(stats.biggestIncome?.amount).toBe(1000);
    });

    it('returns null savings rate and biggest transactions when there is no data', () => {
      const stats = service.periodStats([]);
      expect(stats.savingsRate).toBeNull();
      expect(stats.biggestExpense).toBeNull();
      expect(stats.biggestIncome).toBeNull();
      expect(stats.avgTransaction).toBe(0);
    });
  });

  describe('comparePeriods', () => {
    it('computes percentage change between two periods', () => {
      const current = service.periodStats([txn({ type: 'income', amount: 150 })]);
      const previous = service.periodStats([txn({ type: 'income', amount: 100 })]);

      const comparison = service.comparePeriods(current, previous);
      expect(comparison.incomeChangePct).toBeCloseTo(50);
    });

    it('returns null when the previous period has no baseline', () => {
      const current = service.periodStats([txn({ type: 'income', amount: 150 })]);
      const previous = service.periodStats([]);

      const comparison = service.comparePeriods(current, previous);
      expect(comparison.incomeChangePct).toBeNull();
    });
  });

  describe('topTransactionsByAmount', () => {
    it('returns the largest transactions by amount, limited to N', () => {
      const transactions = [txn({ amount: 50 }), txn({ amount: 300 }), txn({ amount: 150 })];

      const result = service.topTransactionsByAmount(transactions, 2);
      expect(result.length).toBe(2);
      expect(result[0].amount).toBe(300);
      expect(result[1].amount).toBe(150);
    });
  });

  describe('dailyHeatmap', () => {
    it('returns a Monday-aligned grid of weeks*7 days ending on the week containing the reference date', () => {
      const reference = new Date(2026, 0, 15);

      const result = service.dailyHeatmap([], reference, 2);

      expect(result.length).toBe(14);
      expect(result[0].date.getDay()).toBe(1);
      expect(result[result.length - 1].date.getDay()).toBe(0);
    });

    it('sums expense amounts per day and ignores income', () => {
      const reference = new Date(2026, 0, 15);
      const transactions = [
        txn({ date: reference, amount: 100, type: 'expense' }),
        txn({ date: reference, amount: 50, type: 'expense' }),
        txn({ date: reference, amount: 999, type: 'income' })
      ];

      const result = service.dailyHeatmap(transactions, reference, 2);
      const day = result.find(
        (d) =>
          d.date.getFullYear() === reference.getFullYear() &&
          d.date.getMonth() === reference.getMonth() &&
          d.date.getDate() === reference.getDate()
      );

      expect(day?.total).toBe(150);
      expect(day?.isFuture).toBe(false);
    });

    it('marks days after the reference date as future and excludes them from totals', () => {
      const reference = new Date(2026, 0, 15);
      const tomorrow = new Date(2026, 0, 16);
      const transactions = [txn({ date: tomorrow, amount: 500, type: 'expense' })];

      const result = service.dailyHeatmap(transactions, reference, 2);
      const future = result.find((d) => d.date.getTime() === tomorrow.getTime());

      expect(future?.isFuture).toBe(true);
      expect(future?.total).toBe(0);
    });
  });
});
