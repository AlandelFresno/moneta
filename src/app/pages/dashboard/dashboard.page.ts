import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  ElementRef,
  effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, combineLatest } from 'rxjs';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import Chart from 'chart.js/auto';

import { TransactionService } from '../../services/transaction.service';
import { CategoryService } from '../../services/category.service';
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
import { TransactionWithCategory, withCategory } from '../../core/utils/transaction-display.util';
import { palette } from '../../theme.tokens';

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
  imports: [CommonModule, FormsModule, SelectModule, DatePickerModule],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss'
})
export class DashboardPage implements OnInit, AfterViewInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  @ViewChild('trendCanvas') trendCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('expenseBreakdownCanvas') expenseBreakdownCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('incomeBreakdownCanvas') incomeBreakdownCanvasRef!: ElementRef<HTMLCanvasElement>;

  private trendChart: Chart | null = null;
  private expenseBreakdownChart: Chart | null = null;
  private incomeBreakdownChart: Chart | null = null;
  private viewReady = false;

  private allTransactions: Transaction[] = [];
  private categories: Category[] = [];

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

  stats: PeriodStats = EMPTY_STATS;
  comparison: PeriodComparison = EMPTY_COMPARISON;

  expenseBreakdown: CategoryBreakdownEntry[] = [];
  incomeBreakdown: CategoryBreakdownEntry[] = [];
  hasExpenseBreakdown = false;
  hasIncomeBreakdown = false;

  topTransactions: TransactionWithCategory[] = [];

  constructor(
    private readonly transactionService: TransactionService,
    private readonly categoryService: CategoryService,
    private readonly dashboardService: DashboardService,
    private readonly themeService: ThemeService
  ) {
    effect(() => {
      this.themeService.theme();
      if (this.viewReady) {
        this.renderCharts();
      }
    });
  }

  ngOnInit(): void {
    combineLatest([this.transactionService.getAll(), this.categoryService.getAll()])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([transactions, categories]) => {
        this.allTransactions = transactions;
        this.categories = categories;
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

    const previousRange = this.dashboardService.previousRange(this.currentRange);
    const inPreviousRange = this.dashboardService.transactionsInRange(this.allTransactions, previousRange);
    this.comparison = this.dashboardService.comparePeriods(this.stats, this.dashboardService.periodStats(inPreviousRange));

    this.expenseBreakdown = this.dashboardService.categoryBreakdown(inRange, this.categories, 'expense');
    this.incomeBreakdown = this.dashboardService.categoryBreakdown(inRange, this.categories, 'income');
    this.hasExpenseBreakdown = this.expenseBreakdown.length > 0;
    this.hasIncomeBreakdown = this.incomeBreakdown.length > 0;

    this.topTransactions = this.dashboardService
      .topTransactionsByAmount(inRange, 10)
      .map((txn) => withCategory(txn, this.categories));

    this.renderCharts();
  }

  private renderCharts(): void {
    if (!this.viewReady || !this.currentRange) return;
    this.renderTrendChart(this.currentRange);
    this.renderBreakdownCharts();
  }

  private renderTrendChart(range: DateRange): void {
    const trend = this.dashboardService.monthlyTrendInRange(this.allTransactions, range);
    const colors = palette[this.themeService.theme()];

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
            pointRadius: 4,
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
            pointRadius: 4,
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
}
