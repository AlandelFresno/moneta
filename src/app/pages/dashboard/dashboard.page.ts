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
import Chart from 'chart.js/auto';

import { TransactionService } from '../../services/transaction.service';
import { CategoryService } from '../../services/category.service';
import { DashboardService, CategoryBreakdownEntry } from '../../services/dashboard.service';
import { ThemeService } from '../../services/theme.service';
import { Transaction, TransactionType } from '../../core/types/transaction.types';
import { Category } from '../../core/types/category.types';
import { palette } from '../../theme.tokens';

interface MonthOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectModule],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss'
})
export class DashboardPage implements OnInit, AfterViewInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  @ViewChild('trendCanvas') trendCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('breakdownCanvas') breakdownCanvasRef!: ElementRef<HTMLCanvasElement>;

  private trendChart: Chart | null = null;
  private breakdownChart: Chart | null = null;
  private viewReady = false;

  private allTransactions: Transaction[] = [];
  private categories: Category[] = [];

  monthOptions: MonthOption[] = [];
  selectedMonth: string;

  breakdownType: 'expense' | 'income' = 'expense';
  readonly breakdownTypeOptions: { label: string; value: TransactionType }[] = [
    { label: 'Gastos', value: 'expense' },
    { label: 'Ingresos', value: 'income' }
  ];

  stats = {
    income: 0,
    expense: 0,
    balance: 0
  };

  breakdown: CategoryBreakdownEntry[] = [];
  hasBreakdownData = false;

  constructor(
    private readonly transactionService: TransactionService,
    private readonly categoryService: CategoryService,
    private readonly dashboardService: DashboardService,
    private readonly themeService: ThemeService
  ) {
    const now = new Date();
    this.selectedMonth = this.monthKey(now);
    this.monthOptions = this.buildMonthOptions(now);

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
    this.breakdownChart?.destroy();
  }

  private buildMonthOptions(reference: Date): MonthOption[] {
    const options: MonthOption[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(reference.getFullYear(), reference.getMonth() - i, 1);
      options.push({
        label: this.capitalize(new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(d)),
        value: this.monthKey(d)
      });
    }
    return options;
  }

  private capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  private monthKey(date: Date): string {
    return `${date.getFullYear()}-${date.getMonth()}`;
  }

  private parseMonthKey(key: string): { year: number; month: number } {
    const [year, month] = key.split('-').map(Number);
    return { year, month };
  }

  onMonthChange(): void {
    this.recompute();
  }

  onBreakdownTypeChange(): void {
    this.recomputeBreakdown();
    this.renderCharts();
  }

  private recompute(): void {
    const { year, month } = this.parseMonthKey(this.selectedMonth);
    const inMonth = this.dashboardService.transactionsInMonth(this.allTransactions, year, month);

    this.stats.income = inMonth.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    this.stats.expense = inMonth.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    this.stats.balance = this.stats.income - this.stats.expense;

    this.recomputeBreakdown();
    this.renderCharts();
  }

  private recomputeBreakdown(): void {
    const { year, month } = this.parseMonthKey(this.selectedMonth);
    const inMonth = this.dashboardService.transactionsInMonth(this.allTransactions, year, month);
    this.breakdown = this.dashboardService.categoryBreakdown(inMonth, this.categories, this.breakdownType);
    this.hasBreakdownData = this.breakdown.length > 0;
  }

  private renderCharts(): void {
    if (!this.viewReady) return;
    this.renderTrendChart();
    this.renderBreakdownChart();
  }

  private renderTrendChart(): void {
    const { year, month } = this.parseMonthKey(this.selectedMonth);
    const reference = new Date(year, month, 1);
    const trend = this.dashboardService.monthlyTrend(this.allTransactions, 6, reference);
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

  private renderBreakdownChart(): void {
    const colors = palette[this.themeService.theme()];

    this.breakdownChart?.destroy();
    if (this.breakdown.length === 0) return;

    this.breakdownChart = new Chart(this.breakdownCanvasRef.nativeElement, {
      type: 'bar',
      data: {
        labels: this.breakdown.map((b) => b.categoryName),
        datasets: [
          {
            data: this.breakdown.map((b) => b.total),
            backgroundColor: this.breakdown.map((b) => b.categoryColor),
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
