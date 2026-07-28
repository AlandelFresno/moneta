import { Injectable } from '@angular/core';
import { Transaction } from '../core/types/transaction.types';
import { Category } from '../core/types/category.types';

export type RangePreset = 'thisMonth' | 'last3' | 'last6' | 'last12' | 'thisYear' | 'allTime' | 'custom';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface MonthlyTotals {
  monthLabel: string;
  income: number;
  expense: number;
}

export interface CategoryBreakdownEntry {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  total: number;
}

export interface PeriodStats {
  income: number;
  expense: number;
  balance: number;
  transactionCount: number;
  avgTransaction: number;
  savingsRate: number | null;
  biggestExpense: Transaction | null;
  biggestIncome: Transaction | null;
}

export interface PeriodComparison {
  incomeChangePct: number | null;
  expenseChangePct: number | null;
  balanceChangePct: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  rangeForPreset(preset: RangePreset, reference: Date, transactions: Transaction[], custom: DateRange | null): DateRange {
    switch (preset) {
      case 'thisMonth':
        return {
          start: new Date(reference.getFullYear(), reference.getMonth(), 1),
          end: new Date(reference.getFullYear(), reference.getMonth() + 1, 0)
        };
      case 'last3':
      case 'last6':
      case 'last12': {
        const monthsBack = preset === 'last3' ? 3 : preset === 'last6' ? 6 : 12;
        return {
          start: new Date(reference.getFullYear(), reference.getMonth() - (monthsBack - 1), 1),
          end: new Date(reference.getFullYear(), reference.getMonth() + 1, 0)
        };
      }
      case 'thisYear':
        return { start: new Date(reference.getFullYear(), 0, 1), end: new Date(reference.getFullYear(), 11, 31) };
      case 'allTime': {
        if (transactions.length === 0) return { start: reference, end: reference };
        const times = transactions.map((t) => t.date.getTime());
        return { start: new Date(Math.min(...times)), end: new Date(Math.max(...times)) };
      }
      case 'custom':
        return custom ?? { start: reference, end: reference };
    }
  }

  previousRange(range: DateRange): DateRange {
    const start = this.startOfDay(range.start);
    const end = this.endOfDay(range.end);
    const durationMs = end.getTime() - start.getTime() + 1;
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - durationMs + 1);
    return { start: prevStart, end: prevEnd };
  }

  transactionsInRange(transactions: Transaction[], range: DateRange): Transaction[] {
    const start = this.startOfDay(range.start);
    const end = this.endOfDay(range.end);
    return transactions.filter((txn) => txn.date >= start && txn.date <= end);
  }

  categoryBreakdown(transactions: Transaction[], categories: Category[], type: 'income' | 'expense'): CategoryBreakdownEntry[] {
    const totals = new Map<string, number>();

    for (const txn of transactions) {
      if (txn.type !== type) continue;
      totals.set(txn.categoryId, (totals.get(txn.categoryId) ?? 0) + txn.amount);
    }

    return Array.from(totals.entries())
      .map(([categoryId, total]) => {
        const category = categories.find((cat) => cat.id === categoryId);
        return {
          categoryId,
          categoryName: category?.name ?? 'Sin categoría',
          categoryColor: category?.color ?? '#6b7280',
          total
        };
      })
      .sort((a, b) => b.total - a.total);
  }

  monthlyTrendInRange(transactions: Transaction[], range: DateRange): MonthlyTotals[] {
    const months: { year: number; month: number }[] = [];
    let cursor = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
    const last = new Date(range.end.getFullYear(), range.end.getMonth(), 1);

    while (cursor.getTime() <= last.getTime()) {
      months.push({ year: cursor.getFullYear(), month: cursor.getMonth() });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }

    return months.map(({ year, month }) => {
      const inMonth = transactions.filter((txn) => txn.date.getFullYear() === year && txn.date.getMonth() === month);
      return {
        monthLabel: new Intl.DateTimeFormat('es-AR', { month: 'short', year: '2-digit' }).format(new Date(year, month, 1)),
        income: inMonth.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
        expense: inMonth.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
      };
    });
  }

  periodStats(transactions: Transaction[]): PeriodStats {
    const income = transactions.filter((t) => t.type === 'income');
    const expense = transactions.filter((t) => t.type === 'expense');
    const incomeTotal = income.reduce((sum, t) => sum + t.amount, 0);
    const expenseTotal = expense.reduce((sum, t) => sum + t.amount, 0);
    const balance = incomeTotal - expenseTotal;
    const count = transactions.length;

    return {
      income: incomeTotal,
      expense: expenseTotal,
      balance,
      transactionCount: count,
      avgTransaction: count > 0 ? (incomeTotal + expenseTotal) / count : 0,
      savingsRate: incomeTotal > 0 ? (balance / incomeTotal) * 100 : null,
      biggestExpense: expense.length > 0 ? expense.reduce((a, b) => (b.amount > a.amount ? b : a)) : null,
      biggestIncome: income.length > 0 ? income.reduce((a, b) => (b.amount > a.amount ? b : a)) : null
    };
  }

  comparePeriods(current: PeriodStats, previous: PeriodStats): PeriodComparison {
    return {
      incomeChangePct: this.pctChange(current.income, previous.income),
      expenseChangePct: this.pctChange(current.expense, previous.expense),
      balanceChangePct: this.pctChange(current.balance, previous.balance)
    };
  }

  topTransactionsByAmount(transactions: Transaction[], limit: number): Transaction[] {
    return [...transactions].sort((a, b) => b.amount - a.amount).slice(0, limit);
  }

  private pctChange(curr: number, prev: number): number | null {
    if (prev === 0) return null;
    return ((curr - prev) / Math.abs(prev)) * 100;
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private endOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  }
}
