import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DashboardPage } from './dashboard.page';
import { TransactionService } from '../../services/transaction.service';
import { CategoryService } from '../../services/category.service';
import { BillService } from '../../services/bill.service';
import { BudgetService } from '../../services/budget.service';
import { AccountService } from '../../services/account.service';
import { ReportExportService } from '../../services/report-export.service';
import { Transaction } from '../../core/types/transaction.types';
import { Category } from '../../core/types/category.types';
import { Bill } from '../../core/types/bill.types';
import { Account } from '../../core/types/account.types';
import { periodLabelMonth } from '../../core/utils/period.util';
import { HeatmapDay } from '../../services/dashboard.service';

function txn(overrides: Partial<Transaction>): Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    categoryId: 'unmatched-category',
    type: 'expense',
    name: 'Compra',
    description: '',
    amount: 100,
    date: new Date(),
    ...overrides
  };
}

function category(overrides: Partial<Omit<Category, 'id' | 'createdAt' | 'updatedAt'>>): Omit<Category, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: 'Almacén',
    type: 'expense',
    color: '#f00',
    icon: 'tag',
    ...overrides
  };
}

function bill(overrides: Partial<Omit<Bill, 'id' | 'payments' | 'createdAt' | 'updatedAt'>>): Omit<Bill, 'id' | 'payments' | 'createdAt' | 'updatedAt'> {
  return {
    name: 'Alquiler',
    description: '',
    categoryId: 'unmatched-category',
    approxAmount: 500,
    period: 'monthly',
    dueDate: new Date(),
    active: true,
    ...overrides
  };
}

function account(overrides: Partial<Omit<Account, 'id' | 'createdAt' | 'updatedAt'>>): Omit<Account, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: 'Efectivo',
    type: 'cash',
    balance: 1000,
    color: '#3b82f6',
    icon: 'wallet',
    ...overrides
  };
}

describe('DashboardPage', () => {
  let transactionService: TransactionService;
  let categoryService: CategoryService;
  let billService: BillService;
  let budgetService: BudgetService;
  let accountService: AccountService;
  let reportExportService: ReportExportService;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    localStorage.clear();
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), { provide: Router, useValue: routerSpy }]
    });

    transactionService = TestBed.inject(TransactionService);
    categoryService = TestBed.inject(CategoryService);
    billService = TestBed.inject(BillService);
    budgetService = TestBed.inject(BudgetService);
    accountService = TestBed.inject(AccountService);
    reportExportService = TestBed.inject(ReportExportService);

    // exportPdf() -> ReportExportService -> jsPDF -> a real file download; no-op it in tests.
    spyOn(HTMLAnchorElement.prototype, 'click');
  });

  afterEach(() => {
    localStorage.clear();
  });

  // Categories always get a service-generated id (create() ignores any id passed in), so
  // transactions/bills that need to resolve a real category name must use the id it returns.
  async function seedBasicData(): Promise<void> {
    const expenseCategory = await firstValueFrom(categoryService.create(category({ name: 'Almacén', type: 'expense' })));
    const incomeCategory = await firstValueFrom(categoryService.create(category({ name: 'Salario', type: 'income' })));
    await firstValueFrom(
      transactionService.create(txn({ categoryId: expenseCategory.id, type: 'expense', amount: 300, name: 'Super' }))
    );
    await firstValueFrom(
      transactionService.create(txn({ categoryId: incomeCategory.id, type: 'income', amount: 1000, name: 'Sueldo' }))
    );
  }

  describe('initial load (ngOnInit -> recompute)', () => {
    it('computes stats, breakdowns and top transactions for the default "this month" preset', async () => {
      await seedBasicData();

      const fixture = TestBed.createComponent(DashboardPage);
      fixture.detectChanges();
      const component = fixture.componentInstance;

      expect(component.stats.income).toBe(1000);
      expect(component.stats.expense).toBe(300);
      expect(component.stats.balance).toBe(700);
      expect(component.expenseBreakdown.length).toBe(1);
      expect(component.expenseBreakdown[0].categoryName).toBe('Almacén');
      expect(component.hasExpenseBreakdown).toBeTrue();
      expect(component.hasIncomeBreakdown).toBeTrue();
      expect(component.topTransactions.length).toBe(2);
      expect(component.topTransactions.map((t) => t.categoryName)).toEqual(jasmine.arrayContaining(['Almacén', 'Salario']));
    });

    it('starts with empty stats and no breakdowns when there is no data at all', () => {
      const fixture = TestBed.createComponent(DashboardPage);
      fixture.detectChanges();
      const component = fixture.componentInstance;

      expect(component.stats.transactionCount).toBe(0);
      expect(component.hasExpenseBreakdown).toBeFalse();
      expect(component.hasIncomeBreakdown).toBeFalse();
      expect(component.hasCategoryTrend).toBeFalse();
      expect(component.topTransactions).toEqual([]);
    });

    it('sorts accounts alphabetically for the account filter dropdown', async () => {
      await firstValueFrom(accountService.create(account({ name: 'Zeta' })));
      await firstValueFrom(accountService.create(account({ name: 'Alfa' })));

      const fixture = TestBed.createComponent(DashboardPage);
      fixture.detectChanges();

      expect(fixture.componentInstance.accounts.map((a) => a.name)).toEqual(['Alfa', 'Zeta']);
    });

    it('maps upcoming bills within the next 14 days into display entries', async () => {
      const expenseCategory = await firstValueFrom(categoryService.create(category({ name: 'Almacén' })));
      await firstValueFrom(billService.create(bill({ name: 'Alquiler', approxAmount: 500, categoryId: expenseCategory.id })));

      const fixture = TestBed.createComponent(DashboardPage);
      fixture.detectChanges();
      const component = fixture.componentInstance;

      expect(component.upcomingBills.length).toBe(1);
      expect(component.upcomingBills[0].name).toBe('Alquiler');
      expect(component.upcomingBills[0].amount).toBe(500);
      expect(component.upcomingBills[0].categoryName).toBe('Almacén');
      expect(component.upcomingBills[0].isOverdue).toBeFalse();
    });

    it('builds the daily heatmap from scoped transactions', async () => {
      await seedBasicData();

      const fixture = TestBed.createComponent(DashboardPage);
      fixture.detectChanges();
      const component = fixture.componentInstance;

      expect(component.heatmapWeeks.length).toBeGreaterThan(0);
      const allDays = component.heatmapWeeks.flat();
      const today = allDays.find((d) => !d.isFuture && d.date.toDateString() === new Date().toDateString());
      expect(today?.total).toBe(300);
    });
  });

  describe('active budget progress', () => {
    it("loads the current-month budget and computes its progress against this month's expenses", async () => {
      await firstValueFrom(transactionService.create(txn({ categoryId: 'exp', type: 'expense', amount: 200 })));
      await firstValueFrom(budgetService.save(periodLabelMonth(new Date(), 1), 1000, [{ categoryId: 'exp', amount: 1000 }]));

      const fixture = TestBed.createComponent(DashboardPage);
      fixture.detectChanges();
      const component = fixture.componentInstance;

      expect(component.activeBudget).not.toBeNull();
      expect(component.budgetProgress?.categories[0].spent).toBe(200);
    });

    it('has no budget progress when there is no active budget for the current month', () => {
      const fixture = TestBed.createComponent(DashboardPage);
      fixture.detectChanges();

      expect(fixture.componentInstance.activeBudget).toBeNull();
      expect(fixture.componentInstance.budgetProgress).toBeNull();
    });

    it('onPeriodSettingsChange() recomputes both the budget progress and the period stats', async () => {
      await seedBasicData();
      const fixture = TestBed.createComponent(DashboardPage);
      fixture.detectChanges();
      const component = fixture.componentInstance;

      const rangeBefore = component.currentRange;
      component.onPeriodSettingsChange();

      expect(component.currentRange).not.toBeNull();
      expect(component.currentRange).not.toBe(rangeBefore);
    });
  });

  describe('preset / range controls', () => {
    it('onPresetChange() recomputes immediately for a non-custom preset', async () => {
      await seedBasicData();
      const fixture = TestBed.createComponent(DashboardPage);
      fixture.detectChanges();
      const component = fixture.componentInstance;

      component.rangePreset = 'thisYear';
      component.onPresetChange();

      expect(component.currentRange?.start.getMonth()).toBe(0);
    });

    it('onPresetChange() does nothing for "custom" until both range dates are picked', async () => {
      await seedBasicData();
      const fixture = TestBed.createComponent(DashboardPage);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      const rangeBefore = component.currentRange;

      component.rangePreset = 'custom';
      component.customRangeDates = [new Date(2026, 0, 1)];
      component.onPresetChange();
      expect(component.currentRange).toBe(rangeBefore);

      component.customRangeDates = [new Date(2026, 0, 1), new Date(2026, 0, 15)];
      component.onCustomRangeChange();
      expect(component.currentRange).toEqual({ start: new Date(2026, 0, 1), end: new Date(2026, 0, 15) });
    });

    it('onAccountFilterChange() scopes stats down to the selected account only', async () => {
      const acc = await firstValueFrom(accountService.create(account({ name: 'Banco' })));
      await firstValueFrom(transactionService.create(txn({ accountId: acc.id, amount: 150 })));
      await firstValueFrom(transactionService.create(txn({ amount: 999 })));

      const fixture = TestBed.createComponent(DashboardPage);
      fixture.detectChanges();
      const component = fixture.componentInstance;

      component.selectedAccountId = acc.id;
      component.onAccountFilterChange();

      expect(component.stats.expense).toBe(150);
    });
  });

  describe('period comparison', () => {
    it('defaults to comparing against the immediately preceding period', async () => {
      await seedBasicData();
      const fixture = TestBed.createComponent(DashboardPage);
      fixture.detectChanges();
      const component = fixture.componentInstance;

      expect(component.compareRange).not.toBeNull();
      expect(component.compareRange?.end.getTime()).toBeLessThan(component.currentRange!.start.getTime());
    });

    it('onCompareOffsetChange() shifts the comparison range further back for a numeric offset', async () => {
      await seedBasicData();
      const fixture = TestBed.createComponent(DashboardPage);
      fixture.detectChanges();
      const component = fixture.componentInstance;

      component.compareEnabled = true;
      component.onCompareToggle();
      const offsetOneRange = component.compareRange;

      component.compareOffset = 2;
      component.onCompareOffsetChange();

      expect(component.compareRange?.end.getTime()).toBeLessThan(offsetOneRange!.end.getTime());
    });

    it('onCompareOffsetChange() waits for both custom dates before recomputing', async () => {
      await seedBasicData();
      const fixture = TestBed.createComponent(DashboardPage);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.compareEnabled = true;
      component.onCompareToggle();
      const rangeBefore = component.compareRange;

      component.compareOffset = 'custom';
      component.onCompareOffsetChange();
      expect(component.compareRange).toBe(rangeBefore);

      component.compareRangeDates = [new Date(2025, 0, 1), new Date(2025, 0, 31)];
      component.onCompareRangeChange();
      expect(component.compareRange).toEqual({ start: new Date(2025, 0, 1), end: new Date(2025, 0, 31) });
    });

    it('compareLabel() reflects whether comparison is enabled', async () => {
      await seedBasicData();
      const fixture = TestBed.createComponent(DashboardPage);
      fixture.detectChanges();
      const component = fixture.componentInstance;

      expect(component.compareLabel()).toBe('vs. período anterior');

      component.compareEnabled = true;
      component.onCompareToggle();
      expect(component.compareLabel()).toContain('vs.');
      expect(component.compareLabel()).not.toBe('vs. período anterior');
    });

    it('compareOffsetOptions() lists 4 preset offsets plus a custom option, each labeled with its resolved range', async () => {
      await seedBasicData();
      const fixture = TestBed.createComponent(DashboardPage);
      fixture.detectChanges();
      const component = fixture.componentInstance;

      const options = component.compareOffsetOptions();
      expect(options.length).toBe(5);
      expect(options[0].value).toBe(1);
      expect(options[0].label).toContain('Período anterior');
      expect(options[4].value).toBe('custom');
    });
  });

  describe('formatting helpers', () => {
    let component: DashboardPage;

    beforeEach(() => {
      component = TestBed.createComponent(DashboardPage).componentInstance;
    });

    it('formatPct: dash for null, signed percentage otherwise', () => {
      expect(component.formatPct(null)).toBe('—');
      expect(component.formatPct(12.34)).toBe('+12.3%');
      expect(component.formatPct(-5)).toBe('-5.0%');
    });

    it('deltaClass: neutral for null/zero, otherwise green/red depending on direction and whether it is inverted', () => {
      expect(component.deltaClass(null, false)).toBe('text-text-secondary');
      expect(component.deltaClass(0, false)).toBe('text-text-secondary');
      expect(component.deltaClass(10, false)).toBe('text-income');
      expect(component.deltaClass(-10, false)).toBe('text-expense');
      expect(component.deltaClass(10, true)).toBe('text-expense');
      expect(component.deltaClass(-10, true)).toBe('text-income');
    });

    it('formatRange: dash for null, formatted "start – end" otherwise', () => {
      expect(component.formatRange(null)).toBe('—');
      const formatted = component.formatRange({ start: new Date(2026, 0, 1), end: new Date(2026, 0, 31) });
      expect(formatted).toContain('–');
      expect(formatted).toContain('2026');
    });
  });

  describe('heatmapLevel / heatmapTooltip', () => {
    let component: DashboardPage;

    beforeEach(() => {
      component = TestBed.createComponent(DashboardPage).componentInstance;
      component.heatmapMax = 100;
    });

    function day(overrides: Partial<HeatmapDay>): HeatmapDay {
      return { date: new Date(2026, 0, 1), total: 0, isFuture: false, ...overrides };
    }

    it('is -1 for a future day regardless of spend', () => {
      expect(component.heatmapLevel(day({ isFuture: true, total: 999 }))).toBe(-1);
    });

    it('is 0 when there is no spend, or when the max for the period is 0', () => {
      expect(component.heatmapLevel(day({ total: 0 }))).toBe(0);
      component.heatmapMax = 0;
      expect(component.heatmapLevel(day({ total: 50 }))).toBe(0);
    });

    it("scales 1-4 by the ratio of that day's spend to the period max", () => {
      expect(component.heatmapLevel(day({ total: 10 }))).toBe(1);
      expect(component.heatmapLevel(day({ total: 30 }))).toBe(2);
      expect(component.heatmapLevel(day({ total: 60 }))).toBe(3);
      expect(component.heatmapLevel(day({ total: 80 }))).toBe(4);
    });

    it('heatmapTooltip is empty for a future day and a formatted amount otherwise', () => {
      expect(component.heatmapTooltip(day({ isFuture: true }))).toBe('');
      expect(component.heatmapTooltip(day({ total: 1234.5 }))).toContain('1.234,50');
    });
  });

  describe('newTransaction', () => {
    it('navigates to /transactions with the chosen type as a query param', () => {
      const component = TestBed.createComponent(DashboardPage).componentInstance;

      component.newTransaction('income');
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/transactions'], { queryParams: { type: 'income' } });

      component.newTransaction('expense');
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/transactions'], { queryParams: { type: 'expense' } });
    });
  });

  describe('exportPdf', () => {
    it('does nothing when there is no current range yet', async () => {
      const component = TestBed.createComponent(DashboardPage).componentInstance;
      const exportSpy = spyOn(reportExportService, 'exportMonthlyReport').and.callThrough();

      await component.exportPdf();

      expect(exportSpy).not.toHaveBeenCalled();
    });

    it('builds and hands off a report for the current range and stats', async () => {
      await seedBasicData();
      const fixture = TestBed.createComponent(DashboardPage);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      const exportSpy = spyOn(reportExportService, 'exportMonthlyReport').and.callThrough();

      await component.exportPdf();

      expect(exportSpy).toHaveBeenCalledTimes(1);
      const reportData = exportSpy.calls.mostRecent().args[0];
      expect(reportData.range).toEqual(component.currentRange!);
      expect(reportData.stats.income).toBe(1000);
      expect(reportData.topTransactions.length).toBe(2);
    });
  });

  describe('chart rendering (smoke tests only — chart internals belong to a future dedicated charts service)', () => {
    it('renders all charts without throwing when every dataset has data', async () => {
      await seedBasicData();
      await firstValueFrom(accountService.create(account({})));

      expect(() => {
        const fixture = TestBed.createComponent(DashboardPage);
        fixture.detectChanges();
      }).not.toThrow();
    });

    it('renders without throwing when there is no data at all (empty breakdown/category-trend branches)', () => {
      expect(() => {
        const fixture = TestBed.createComponent(DashboardPage);
        fixture.detectChanges();
      }).not.toThrow();
    });
  });
});
