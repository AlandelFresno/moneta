import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
  effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil, combineLatest } from 'rxjs';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import Chart from 'chart.js/auto';

import { TransactionService } from '../../services/transaction.service';
import { CategoryService } from '../../services/category.service';
import { BillService } from '../../services/bill.service';
import {
  DashboardService,
  CategoryBreakdownEntry,
  DateRange,
  PeriodStats,
  PeriodComparison,
  RangePreset
} from '../../services/dashboard.service';
import { ThemeService } from '../../services/theme.service';
import { Transaction } from '../../core/types/transaction.types';
import { Category } from '../../core/types/category.types';
import { Bill } from '../../core/types/bill.types';
import { TransactionWithCategory, withCategory } from '../../core/utils/transaction-display.util';
import { palette } from '../../theme.tokens';

export interface UpcomingBillDisplay {
  billId: string;
  name: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  amount: number;
  dueDate: Date;
  isOverdue: boolean;
}

const EMPTY_STATS: PeriodStats = {
  income: 0,
  expense: 0,
  balance: 0,
  transactionCount: 0,
  avgTransaction: 0,
  savingsRate: null,
  biggestExpense: null,
  biggestIncome: null
};

const EMPTY_COMPARISON: PeriodComparison = {
  incomeChangePct: null,
  expenseChangePct: null,
  balanceChangePct: null
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectModule, DatePickerModule, ToggleSwitchModule],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss'
})
export class DashboardPage implements OnInit, AfterViewInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  @ViewChild('trendCanvas') trendCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('expenseBreakdownCanvas') expenseBreakdownCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('incomeBreakdownCanvas') incomeBreakdownCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('categoryTrendCanvas') categoryTrendCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('weekdayCanvas') weekdayCanvasRef!: ElementRef<HTMLCanvasElement>;

  private trendChart: Chart | null = null;
  private expenseBreakdownChart: Chart | null = null;
  private incomeBreakdownChart: Chart | null = null;
  private categoryTrendChart: Chart | null = null;
  private weekdayChart: Chart | null = null;
  private viewReady = false;

  private allTransactions: Transaction[] = [];
  private categories: Category[] = [];
  private allBills: Bill[] = [];

  readonly presetOptions: { label: string; value: RangePreset }[] = [
    { label: 'Este mes', value: 'thisMonth' },
    { label: 'Últimos 3 meses', value: 'last3' },
    { label: 'Últimos 6 meses', value: 'last6' },
    { label: 'Últimos 12 meses', value: 'last12' },
    { label: 'Este año', value: 'thisYear' },
    { label: 'Todo', value: 'allTime' },
    { label: 'Rango personalizado', value: 'custom' }
  ];

  rangePreset: RangePreset = 'thisMonth';
  customRangeDates: Date[] | null = null;
  currentRange: DateRange | null = null;

  compareEnabled = false;
  comparePreset: RangePreset = 'last3';
  compareRangeDates: Date[] | null = null;
  compareRange: DateRange | null = null;
  compareStats: PeriodStats = EMPTY_STATS;

  stats: PeriodStats = EMPTY_STATS;
  comparison: PeriodComparison = EMPTY_COMPARISON;

  expenseBreakdown: CategoryBreakdownEntry[] = [];
  incomeBreakdown: CategoryBreakdownEntry[] = [];
  hasExpenseBreakdown = false;
  hasIncomeBreakdown = false;

  topTransactions: TransactionWithCategory[] = [];
  upcomingBills: UpcomingBillDisplay[] = [];
  hasCategoryTrend = false;

  constructor(
    private readonly transactionService: TransactionService,
    private readonly categoryService: CategoryService,
    private readonly billService: BillService,
    private readonly dashboardService: DashboardService,
    private readonly themeService: ThemeService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) {
    effect(() => {
      this.themeService.theme();
      if (this.viewReady) {
        this.renderCharts();
      }
    });
  }

  ngOnInit(): void {
    combineLatest([this.transactionService.getAll(), this.categoryService.getAll(), this.billService.getAll()])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([transactions, categories, bills]) => {
        this.allTransactions = transactions;
        this.categories = categories;
        this.allBills = bills;
        this.recompute();
      });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.renderCharts();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.trendChart?.destroy();
    this.expenseBreakdownChart?.destroy();
    this.incomeBreakdownChart?.destroy();
    this.categoryTrendChart?.destroy();
    this.weekdayChart?.destroy();
  }

  onPresetChange(): void {
    if (this.rangePreset !== 'custom') {
      this.recompute();
      return;
    }
    if (this.customRangeDates?.length === 2 && this.customRangeDates[1]) {
      this.recompute();
    }
  }

  onCustomRangeChange(): void {
    if (this.customRangeDates?.length === 2 && this.customRangeDates[1]) {
      this.recompute();
    }
  }

  onCompareToggle(): void {
    this.recompute();
  }

  onComparePresetChange(): void {
    if (this.comparePreset !== 'custom') {
      this.recompute();
      return;
    }
    if (this.compareRangeDates?.length === 2 && this.compareRangeDates[1]) {
      this.recompute();
    }
  }

  onCompareRangeChange(): void {
    if (this.compareRangeDates?.length === 2 && this.compareRangeDates[1]) {
      this.recompute();
    }
  }

  formatPct(pct: number | null): string {
    if (pct === null) return '—';
    const sign = pct > 0 ? '+' : '';
    return `${sign}${pct.toFixed(1)}%`;
  }

  deltaClass(pct: number | null, invert: boolean): string {
    if (pct === null || pct === 0) return 'text-text-secondary';
    const positive = invert ? pct < 0 : pct > 0;
    return positive ? 'text-income' : 'text-expense';
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  }

  formatRange(range: DateRange | null): string {
    if (!range) return '—';
    return `${this.formatDate(range.start)} – ${this.formatDate(range.end)}`;
  }

  compareLabel(): string {
    return this.compareEnabled ? `vs. ${this.formatRange(this.compareRange)}` : 'vs. período anterior';
  }

  newTransaction(type: 'income' | 'expense'): void {
    void this.router.navigate(['/transactions'], { queryParams: { type } });
  }

  private recompute(): void {
    const reference = new Date();
    const custom =
      this.customRangeDates?.length === 2 && this.customRangeDates[1]
        ? { start: this.customRangeDates[0], end: this.customRangeDates[1] }
        : null;

    if (this.rangePreset === 'custom' && !custom) {
      return;
    }

    this.currentRange = this.dashboardService.rangeForPreset(this.rangePreset, reference, this.allTransactions, custom);
    const inRange = this.dashboardService.transactionsInRange(this.allTransactions, this.currentRange);

    this.stats = this.dashboardService.periodStats(inRange);

    if (this.compareEnabled) {
      const compareCustom =
        this.comparePreset === 'custom' && this.compareRangeDates?.length === 2 && this.compareRangeDates[1]
          ? { start: this.compareRangeDates[0], end: this.compareRangeDates[1] }
          : null;

      if (this.comparePreset !== 'custom' || compareCustom) {
        this.compareRange = this.dashboardService.rangeForPreset(
          this.comparePreset,
          reference,
          this.allTransactions,
          compareCustom
        );
      }
    } else {
      this.compareRange = this.dashboardService.previousRange(this.currentRange);
    }

    const inCompareRange = this.compareRange
      ? this.dashboardService.transactionsInRange(this.allTransactions, this.compareRange)
      : [];
    this.compareStats = this.dashboardService.periodStats(inCompareRange);
    this.comparison = this.dashboardService.comparePeriods(this.stats, this.compareStats);

    this.expenseBreakdown = this.dashboardService.categoryBreakdown(inRange, this.categories, 'expense');
    this.incomeBreakdown = this.dashboardService.categoryBreakdown(inRange, this.categories, 'income');
    this.hasExpenseBreakdown = this.expenseBreakdown.length > 0;
    this.hasIncomeBreakdown = this.incomeBreakdown.length > 0;

    this.topTransactions = this.dashboardService
      .topTransactionsByAmount(inRange, 10)
      .map((txn) => withCategory(txn, this.categories));

    this.hasCategoryTrend = this.dashboardService.categoryBreakdown(inRange, this.categories, 'expense').length > 0;

    this.upcomingBills = this.billService.upcomingBills(this.allBills, reference, 14).map((status) => {
      const category = this.categories.find((cat) => cat.id === status.bill.categoryId);
      return {
        billId: status.bill.id,
        name: status.bill.name,
        categoryName: category?.name ?? 'Sin categoría',
        categoryColor: category?.color ?? '#6b7280',
        categoryIcon: category?.icon ?? 'tag',
        amount: status.bill.approxAmount,
        dueDate: status.periodDueDate,
        isOverdue: status.isOverdue
      };
    });

    this.cdr.detectChanges();
    this.renderCharts();
  }

  private renderCharts(): void {
    if (!this.viewReady || !this.currentRange) return;
    this.renderTrendChart(this.currentRange);
    this.renderBreakdownCharts();
    this.renderCategoryTrendChart(this.currentRange);
    this.renderWeekdayChart(this.currentRange);
  }

  private renderTrendChart(range: DateRange): void {
    const today = new Date();
    const trendRange: DateRange = { start: range.start, end: range.end > today ? today : range.end };
    const trend = this.dashboardService.trendInRange(this.allTransactions, trendRange);
    const colors = palette[this.themeService.theme()];
    const pointRadius = trend.length > 15 ? 0 : 4;

    this.trendChart?.destroy();
    this.trendChart = new Chart(this.trendCanvasRef.nativeElement, {
      type: 'line',
      data: {
        labels: trend.map((m) => m.monthLabel),
        datasets: [
          {
            label: 'Ingresos',
            data: trend.map((m) => m.income),
            borderColor: colors.income,
            backgroundColor: `${colors.income}1a`,
            borderWidth: 2,
            pointRadius,
            pointHoverRadius: 4,
            pointBackgroundColor: colors.income,
            pointBorderColor: colors.surfaceCard,
            pointBorderWidth: 2,
            fill: true,
            tension: 0.3
          },
          {
            label: 'Gastos',
            data: trend.map((m) => m.expense),
            borderColor: colors.expense,
            backgroundColor: `${colors.expense}1a`,
            borderWidth: 2,
            pointRadius,
            pointHoverRadius: 4,
            pointBackgroundColor: colors.expense,
            pointBorderColor: colors.surfaceCard,
            pointBorderWidth: 2,
            fill: true,
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: { color: colors.textSecondary, usePointStyle: true, boxWidth: 8 }
          },
          tooltip: {
            backgroundColor: colors.surfaceCard,
            titleColor: colors.textPrimary,
            bodyColor: colors.textPrimary,
            borderColor: colors.borderSubtle,
            borderWidth: 1,
            padding: 10
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: colors.textSecondary }
          },
          y: {
            grid: { color: colors.borderSubtle },
            ticks: { color: colors.textSecondary },
            beginAtZero: true
          }
        }
      }
    });
  }

  private renderBreakdownCharts(): void {
    this.expenseBreakdownChart?.destroy();
    this.expenseBreakdownChart = this.hasExpenseBreakdown
      ? this.renderCategoryBreakdownChart(this.expenseBreakdownCanvasRef.nativeElement, this.expenseBreakdown)
      : null;

    this.incomeBreakdownChart?.destroy();
    this.incomeBreakdownChart = this.hasIncomeBreakdown
      ? this.renderCategoryBreakdownChart(this.incomeBreakdownCanvasRef.nativeElement, this.incomeBreakdown)
      : null;
  }

  private renderCategoryBreakdownChart(canvas: HTMLCanvasElement, entries: CategoryBreakdownEntry[]): Chart {
    const colors = palette[this.themeService.theme()];

    return new Chart(canvas, {
      type: 'bar',
      data: {
        labels: entries.map((b) => b.categoryName),
        datasets: [
          {
            data: entries.map((b) => b.total),
            backgroundColor: entries.map((b) => b.categoryColor),
            borderRadius: 4,
            barThickness: 20
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: colors.surfaceCard,
            titleColor: colors.textPrimary,
            bodyColor: colors.textPrimary,
            borderColor: colors.borderSubtle,
            borderWidth: 1,
            padding: 10
          }
        },
        scales: {
          x: {
            grid: { color: colors.borderSubtle },
            ticks: { color: colors.textSecondary },
            beginAtZero: true
          },
          y: {
            grid: { display: false },
            ticks: { color: colors.textPrimary }
          }
        }
      }
    });
  }

  private renderCategoryTrendChart(range: DateRange): void {
    this.categoryTrendChart?.destroy();
    if (!this.hasCategoryTrend) {
      this.categoryTrendChart = null;
      return;
    }

    const today = new Date();
    const trendRange: DateRange = { start: range.start, end: range.end > today ? today : range.end };
    const trend = this.dashboardService.categoryTrendInRange(this.allTransactions, this.categories, trendRange, 5);
    const colors = palette[this.themeService.theme()];

    this.categoryTrendChart = new Chart(this.categoryTrendCanvasRef.nativeElement, {
      type: 'line',
      data: {
        labels: trend.monthLabels,
        datasets: trend.series.map((s) => ({
          label: s.categoryName,
          data: s.totals,
          borderColor: s.categoryColor,
          backgroundColor: `${s.categoryColor}1a`,
          borderWidth: 2,
          pointRadius: trend.monthLabels.length > 15 ? 0 : 3,
          pointHoverRadius: 4,
          pointBackgroundColor: s.categoryColor,
          tension: 0.3
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: { color: colors.textSecondary, usePointStyle: true, boxWidth: 8 }
          },
          tooltip: {
            backgroundColor: colors.surfaceCard,
            titleColor: colors.textPrimary,
            bodyColor: colors.textPrimary,
            borderColor: colors.borderSubtle,
            borderWidth: 1,
            padding: 10
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: colors.textSecondary }
          },
          y: {
            grid: { color: colors.borderSubtle },
            ticks: { color: colors.textSecondary },
            beginAtZero: true
          }
        }
      }
    });
  }

  private renderWeekdayChart(range: DateRange): void {
    const inRange = this.dashboardService.transactionsInRange(this.allTransactions, range);
    const weekdaySpend = this.dashboardService.weekdaySpendInRange(inRange);
    const colors = palette[this.themeService.theme()];

    this.weekdayChart?.destroy();
    this.weekdayChart = new Chart(this.weekdayCanvasRef.nativeElement, {
      type: 'bar',
      data: {
        labels: weekdaySpend.map((w) => w.weekdayLabel),
        datasets: [
          {
            data: weekdaySpend.map((w) => w.total),
            backgroundColor: colors.expense,
            borderRadius: 4,
            barThickness: 28
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: colors.surfaceCard,
            titleColor: colors.textPrimary,
            bodyColor: colors.textPrimary,
            borderColor: colors.borderSubtle,
            borderWidth: 1,
            padding: 10
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: colors.textSecondary }
          },
          y: {
            grid: { color: colors.borderSubtle },
            ticks: { color: colors.textSecondary },
            beginAtZero: true
          }
        }
      }
    });
  }
}
