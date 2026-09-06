import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ReportExportService, MonthlyReportData } from './report-export.service';
import { Transaction } from '../core/types/transaction.types';
import { Category } from '../core/types/category.types';

function txn(overrides: Partial<Transaction>): Transaction {
  return {
    id: Math.random().toString(),
    categoryId: 'cat-1',
    type: 'expense',
    name: 'Compra',
    description: '',
    amount: 100,
    date: new Date(2026, 0, 15),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

const CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Almacén', type: 'expense', color: '#f00', icon: 'tag', createdAt: new Date(), updatedAt: new Date() }
];

function reportData(overrides: Partial<MonthlyReportData> = {}): MonthlyReportData {
  return {
    range: { start: new Date(2026, 0, 1), end: new Date(2026, 0, 31) },
    stats: {
      income: 1000,
      expense: 400,
      balance: 600,
      transactionCount: 2,
      avgTransaction: 500,
      savingsRate: 60,
      biggestExpense: txn({ amount: 400 }),
      biggestIncome: txn({ amount: 1000, type: 'income' })
    },
    comparison: { incomeChangePct: 10, expenseChangePct: -5, balanceChangePct: 20 },
    expenseBreakdown: [{ categoryId: 'cat-1', categoryName: 'Almacén', categoryColor: '#f00', total: 400 }],
    incomeBreakdown: [],
    topTransactions: [txn({ amount: 400 })],
    categories: CATEGORIES,
    trendChartImage: null,
    ...overrides
  };
}

describe('ReportExportService', () => {
  let service: ReportExportService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    service = TestBed.inject(ReportExportService);
    // exportMonthlyReport() triggers a real file download (jsPDF -> anchor click); no-op it in tests.
    spyOn(HTMLAnchorElement.prototype, 'click');
  });

  it('generates and saves a report for a normal month of data without throwing', async () => {
    await expectAsync(service.exportMonthlyReport(reportData())).toBeResolved();
  });

  it('handles a month with no breakdowns and no transactions (nothing to report)', async () => {
    const empty = reportData({
      stats: {
        income: 0,
        expense: 0,
        balance: 0,
        transactionCount: 0,
        avgTransaction: 0,
        savingsRate: null,
        biggestExpense: null,
        biggestIncome: null
      },
      comparison: { incomeChangePct: null, expenseChangePct: null, balanceChangePct: null },
      expenseBreakdown: [],
      incomeBreakdown: [],
      topTransactions: []
    });

    await expectAsync(service.exportMonthlyReport(empty)).toBeResolved();
  });

  it('handles a category/transaction list long enough to force a page break', async () => {
    const manyEntries = Array.from({ length: 40 }, (_, i) => ({
      categoryId: `cat-${i}`,
      categoryName: `Categoría ${i}`,
      categoryColor: '#f00',
      total: 10
    }));
    const manyTxns = Array.from({ length: 40 }, (_, i) => txn({ id: `t-${i}`, amount: 10 }));

    await expectAsync(
      service.exportMonthlyReport(reportData({ expenseBreakdown: manyEntries, topTransactions: manyTxns }))
    ).toBeResolved();
  });
});
