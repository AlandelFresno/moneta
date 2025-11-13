import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject, combineLatest, takeUntil } from 'rxjs';
import {
  Chart,
  ChartConfiguration,
  ChartData,
  ChartType,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  LineController,
  BarController,
  PieController
} from 'chart.js';

import { Transaction } from '../../models/transaction.model';
import { Category } from '../../models/category.model';
import { Account } from '../../models/account.model';
import { TransactionService } from '../../services/transaction.service';
import { CategoryService } from '../../services/category.service';
import { AccountService } from '../../services/account.service';
import { ExchangeRateService } from '../../services/exchange-rate.service';
import { PreferencesService } from '../../services/preferences.service';

// Register Chart.js components
Chart.register(
  // Scales
  CategoryScale,
  LinearScale,
  // Elements
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  // Controllers
  LineController,
  BarController,
  PieController,
  // Plugins
  Title,
  Tooltip,
  Legend,
  Filler
);

interface PeriodStats {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  transactionCount: number;
  avgTransactionAmount: number;
  topCategory: { name: string; amount: number } | null;
}

interface CategoryStat {
  id: string;
  name: string;
  color: string;
  amount: number;
  count: number;
  percentage: number;
}

@Component({
  selector: 'app-analytics',
  templateUrl: './analytics.page.html',
  styleUrls: ['./analytics.page.scss'],
  standalone: false
})
export class AnalyticsPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  transactions: Transaction[] = [];
  categories: Category[] = [];
  accounts: Account[] = [];

  selectedPeriod: 'week' | 'month' | 'year' | 'all' | 'custom' = 'month';
  customStartDate: string = '';
  customEndDate: string = '';
  showCustomDatePicker = false;

  // Statistics
  currentPeriodStats: PeriodStats = this.getEmptyStats();
  previousPeriodStats: PeriodStats = this.getEmptyStats();

  expensesByCategory: CategoryStat[] = [];
  incomesByCategory: CategoryStat[] = [];

  // Chart data
  expensePieChartData: ChartData<'pie'> = { labels: [], datasets: [] };
  incomePieChartData: ChartData<'pie'> = { labels: [], datasets: [] };
  trendChartData: ChartData<'line'> = { labels: [], datasets: [] };
  monthlyComparisonData: ChartData<'bar'> = { labels: [], datasets: [] };

  // Chart options
  pieChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          boxWidth: 12,
          padding: 10,
          font: { size: 11 }
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = (context.dataset.data as number[]).reduce((a, b) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: $${value.toFixed(2)} (${percentage}%)`;
          }
        }
      }
    }
  };

  lineChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          boxWidth: 12,
          padding: 15,
          font: { size: 12 }
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => '$' + value
        }
      }
    }
  };

  barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          boxWidth: 12,
          padding: 15,
          font: { size: 12 }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => '$' + value
        }
      }
    }
  };

  constructor(
    private transactionService: TransactionService,
    private categoryService: CategoryService,
    private accountService: AccountService,
    private exchangeRateService: ExchangeRateService,
    private preferencesService: PreferencesService
  ) {}

  ngOnInit(): void {
    combineLatest([
      this.transactionService.transactions$,
      this.categoryService.categories$,
      this.accountService.accounts$
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([transactions, categories, accounts]) => {
        this.transactions = transactions;
        this.categories = categories;
        this.accounts = accounts;
        this.calculateAnalytics();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onPeriodChange(period: 'week' | 'month' | 'year' | 'all' | 'custom'): void {
    if (period === 'custom') {
      this.showCustomDatePicker = true;
      this.selectedPeriod = period;
      // No calculamos hasta que seleccione las fechas
      return;
    }
    this.showCustomDatePicker = false;
    this.selectedPeriod = period;
    this.calculateAnalytics();
  }

  onCustomDateChange(): void {
    if (this.customStartDate && this.customEndDate) {
      this.showCustomDatePicker = false;
      this.calculateAnalytics();
    }
  }

  onCancelCustomDate(): void {
    this.showCustomDatePicker = false;
    if (this.selectedPeriod === 'custom' && (!this.customStartDate || !this.customEndDate)) {
      // Si estaba en custom pero no seleccionó fechas, volver a month
      this.selectedPeriod = 'month';
      this.calculateAnalytics();
    }
  }

  getTodayString(): string {
    return new Date().toISOString().split('T')[0];
  }

  private getEmptyStats(): PeriodStats {
    return {
      totalIncome: 0,
      totalExpense: 0,
      balance: 0,
      transactionCount: 0,
      avgTransactionAmount: 0,
      topCategory: null
    };
  }

  private calculateAnalytics(): void {
    const now = new Date();
    const { start: currentStart, end: currentEnd } = this.getPeriodDates(now, this.selectedPeriod);
    const { start: previousStart, end: previousEnd } = this.getPreviousPeriodDates(now, this.selectedPeriod);

    const currentTransactions = this.filterTransactionsByPeriod(this.transactions, currentStart, currentEnd);
    const previousTransactions = this.filterTransactionsByPeriod(this.transactions, previousStart, previousEnd);

    this.currentPeriodStats = this.calculatePeriodStats(currentTransactions);
    this.previousPeriodStats = this.calculatePeriodStats(previousTransactions);

    this.calculateCategoryStats(currentTransactions);
    this.generateCharts(currentTransactions);
  }

  private getPeriodDates(date: Date, period: string): { start: Date; end: Date } {
    // Si es período personalizado, usar las fechas del rango
    if (period === 'custom' && this.customStartDate && this.customEndDate) {
      const start = new Date(this.customStartDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(this.customEndDate);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    let start = new Date(date);

    switch (period) {
      case 'week':
        start.setDate(date.getDate() - 7);
        break;
      case 'month':
        start.setMonth(date.getMonth() - 1);
        break;
      case 'year':
        start.setFullYear(date.getFullYear() - 1);
        break;
      case 'all':
        start = new Date(0); // Beginning of time
        break;
    }

    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  private getPreviousPeriodDates(date: Date, period: string): { start: Date; end: Date } {
    const { start: currentStart } = this.getPeriodDates(date, period);
    const duration = date.getTime() - currentStart.getTime();

    const end = new Date(currentStart.getTime() - 1);
    const start = new Date(end.getTime() - duration);

    return { start, end };
  }

  private filterTransactionsByPeriod(transactions: Transaction[], start: Date, end: Date): Transaction[] {
    return transactions.filter(t => {
      const txDate = new Date(t.date);
      return txDate >= start && txDate <= end;
    });
  }

  private calculatePeriodStats(transactions: Transaction[]): PeriodStats {
    const preferredCurrency = this.preferencesService.getPreferredCurrency();

    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + this.exchangeRateService.convertToPreferredCurrency(t.amount, t.currency, preferredCurrency), 0);

    const expense = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + this.exchangeRateService.convertToPreferredCurrency(t.amount, t.currency, preferredCurrency), 0);

    const avgAmount = transactions.length > 0
      ? (income + expense) / transactions.length
      : 0;

    // Find top category
    const categoryTotals = new Map<string, number>();
    transactions.filter(t => t.type === 'expense').forEach(t => {
      const current = categoryTotals.get(t.categoryId) || 0;
      categoryTotals.set(t.categoryId, current + this.exchangeRateService.convertToPreferredCurrency(t.amount, t.currency, preferredCurrency));
    });

    let topCategory = null;
    let maxAmount = 0;
    categoryTotals.forEach((amount, categoryId) => {
      if (amount > maxAmount) {
        maxAmount = amount;
        const cat = this.categories.find(c => c.id === categoryId);
        topCategory = { name: cat?.name || 'Unknown', amount };
      }
    });

    return {
      totalIncome: income,
      totalExpense: expense,
      balance: income - expense,
      transactionCount: transactions.length,
      avgTransactionAmount: avgAmount,
      topCategory
    };
  }

  private calculateCategoryStats(transactions: Transaction[]): void {
    const preferredCurrency = this.preferencesService.getPreferredCurrency();

    // Expenses by category
    const expenseMap = new Map<string, { amount: number; count: number }>();
    transactions.filter(t => t.type === 'expense').forEach(t => {
      const current = expenseMap.get(t.categoryId) || { amount: 0, count: 0 };
      current.amount += this.exchangeRateService.convertToPreferredCurrency(t.amount, t.currency, preferredCurrency);
      current.count += 1;
      expenseMap.set(t.categoryId, current);
    });

    const totalExpense = Array.from(expenseMap.values()).reduce((sum, v) => sum + v.amount, 0);

    this.expensesByCategory = Array.from(expenseMap.entries())
      .map(([categoryId, data]) => {
        const category = this.categories.find(c => c.id === categoryId);
        return {
          id: categoryId,
          name: category?.name || 'Unknown',
          color: category?.color || '#6b7280',
          amount: data.amount,
          count: data.count,
          percentage: totalExpense > 0 ? (data.amount / totalExpense) * 100 : 0
        };
      })
      .sort((a, b) => b.amount - a.amount);

    // Incomes by category
    const incomeMap = new Map<string, { amount: number; count: number }>();
    transactions.filter(t => t.type === 'income').forEach(t => {
      const current = incomeMap.get(t.categoryId) || { amount: 0, count: 0 };
      current.amount += this.exchangeRateService.convertToPreferredCurrency(t.amount, t.currency, preferredCurrency);
      current.count += 1;
      incomeMap.set(t.categoryId, current);
    });

    const totalIncome = Array.from(incomeMap.values()).reduce((sum, v) => sum + v.amount, 0);

    this.incomesByCategory = Array.from(incomeMap.entries())
      .map(([categoryId, data]) => {
        const category = this.categories.find(c => c.id === categoryId);
        return {
          id: categoryId,
          name: category?.name || 'Unknown',
          color: category?.color || '#6b7280',
          amount: data.amount,
          count: data.count,
          percentage: totalIncome > 0 ? (data.amount / totalIncome) * 100 : 0
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }

  private generateCharts(transactions: Transaction[]): void {
    this.generatePieCharts();
    this.generateTrendChart(transactions);
    this.generateMonthlyComparison();
  }

  private generatePieCharts(): void {
    // Expense pie chart
    if (this.expensesByCategory.length > 0) {
      this.expensePieChartData = {
        labels: this.expensesByCategory.map(c => c.name),
        datasets: [{
          data: this.expensesByCategory.map(c => c.amount),
          backgroundColor: this.expensesByCategory.map(c => c.color),
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      };
    }

    // Income pie chart
    if (this.incomesByCategory.length > 0) {
      this.incomePieChartData = {
        labels: this.incomesByCategory.map(c => c.name),
        datasets: [{
          data: this.incomesByCategory.map(c => c.amount),
          backgroundColor: this.incomesByCategory.map(c => c.color),
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      };
    }
  }

  private generateTrendChart(transactions: Transaction[]): void {
    const preferredCurrency = this.preferencesService.getPreferredCurrency();

    // Get last 6 months
    const months: string[] = [];
    const incomeData: number[] = [];
    const expenseData: number[] = [];

    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthName = date.toLocaleString('default', { month: 'short', year: '2-digit' });
      months.push(monthName);

      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const monthTransactions = this.filterTransactionsByPeriod(transactions, monthStart, monthEnd);

      const income = monthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + this.exchangeRateService.convertToPreferredCurrency(t.amount, t.currency, preferredCurrency), 0);

      const expense = monthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + this.exchangeRateService.convertToPreferredCurrency(t.amount, t.currency, preferredCurrency), 0);

      incomeData.push(income);
      expenseData.push(expense);
    }

    this.trendChartData = {
      labels: months,
      datasets: [
        {
          label: 'Income',
          data: incomeData,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'Expense',
          data: expenseData,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          tension: 0.4,
          fill: true
        }
      ]
    };
  }

  private generateMonthlyComparison(): void {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();
    const preferredCurrency = this.preferencesService.getPreferredCurrency();

    const incomeData: number[] = [];
    const expenseData: number[] = [];

    for (let month = 0; month < 12; month++) {
      const monthStart = new Date(currentYear, month, 1);
      const monthEnd = new Date(currentYear, month + 1, 0);

      const monthTransactions = this.filterTransactionsByPeriod(this.transactions, monthStart, monthEnd);

      const income = monthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + this.exchangeRateService.convertToPreferredCurrency(t.amount, t.currency, preferredCurrency), 0);

      const expense = monthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + this.exchangeRateService.convertToPreferredCurrency(t.amount, t.currency, preferredCurrency), 0);

      incomeData.push(income);
      expenseData.push(expense);
    }

    this.monthlyComparisonData = {
      labels: months,
      datasets: [
        {
          label: 'Income',
          data: incomeData,
          backgroundColor: '#10b981',
          borderRadius: 6
        },
        {
          label: 'Expense',
          data: expenseData,
          backgroundColor: '#ef4444',
          borderRadius: 6
        }
      ]
    };
  }

  getPeriodLabel(): string {
    switch (this.selectedPeriod) {
      case 'week': return 'Últimos 7 Días';
      case 'month': return 'Últimos 30 Días';
      case 'year': return 'Últimos 12 Meses';
      case 'all': return 'Todo el Tiempo';
      case 'custom':
        if (this.customStartDate && this.customEndDate) {
          const start = new Date(this.customStartDate);
          const end = new Date(this.customEndDate);
          return `${start.toLocaleDateString('es-AR')} - ${end.toLocaleDateString('es-AR')}`;
        }
        return 'Período Personalizado';
      default: return '';
    }
  }

  getPercentageChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  getCurrentYear(): number {
    return new Date().getFullYear();
  }
}
