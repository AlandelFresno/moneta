import { Injectable } from '@angular/core';
import { Transaction } from '../core/types/transaction.types';
import { Category } from '../core/types/category.types';

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

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  transactionsInMonth(transactions: Transaction[], year: number, month: number): Transaction[] {
    return transactions.filter((txn) => txn.date.getFullYear() === year && txn.date.getMonth() === month);
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

  monthlyTrend(transactions: Transaction[], monthsBack: number, referenceDate: Date): MonthlyTotals[] {
    const months: { year: number; month: number }[] = [];
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() });
    }

    return months.map(({ year, month }) => {
      const inMonth = this.transactionsInMonth(transactions, year, month);
      return {
        monthLabel: new Intl.DateTimeFormat('es-AR', { month: 'short', year: '2-digit' }).format(new Date(year, month, 1)),
        income: inMonth.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
        expense: inMonth.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
      };
    });
  }
}
