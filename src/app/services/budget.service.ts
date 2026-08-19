import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { Budget, BudgetAllocation, BudgetProgress, BudgetSuggestMethod, CategoryProgress } from '../core/types/budget.types';
import { Transaction } from '../core/types/transaction.types';

export interface StoredBudget extends Omit<Budget, 'month' | 'createdAt' | 'updatedAt' | 'deletedAt'> {
  month: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export function toBudget(stored: StoredBudget): Budget {
  return {
    ...stored,
    month: new Date(stored.month),
    createdAt: new Date(stored.createdAt),
    updatedAt: new Date(stored.updatedAt),
    deletedAt: stored.deletedAt ? new Date(stored.deletedAt) : undefined
  };
}

export function fromBudget(budget: Budget): StoredBudget {
  return {
    ...budget,
    month: budget.month.toISOString(),
    createdAt: budget.createdAt.toISOString(),
    updatedAt: budget.updatedAt.toISOString(),
    deletedAt: budget.deletedAt ? budget.deletedAt.toISOString() : undefined
  };
}

@Injectable({
  providedIn: 'root'
})
export class BudgetService {
  private readonly storageKey = 'budgets';
  private readonly allSubject = new BehaviorSubject<Budget[]>(this.loadAll());
  readonly budgets$: Observable<Budget[]> = this.allSubject.pipe(map((budgets) => budgets.filter((budget) => !budget.deletedAt)));

  constructor() {
    this.carryForwardIfNeeded();
  }

  private loadAll(): Budget[] {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) return [];

    const stored: StoredBudget[] = JSON.parse(raw);
    return stored.map((budget) => toBudget(budget));
  }

  private persist(budgets: Budget[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(budgets.map((budget) => fromBudget(budget))));
  }

  getAll(): Observable<Budget[]> {
    return this.budgets$;
  }

  getAllIncludingDeleted(): Budget[] {
    return this.allSubject.value;
  }

  replaceAll(budgets: Budget[]): void {
    this.persist(budgets);
    this.allSubject.next(budgets);
  }

  getCurrent(): Observable<Budget | null> {
    return this.budgets$.pipe(map((budgets) => this.currentBudget(budgets, new Date())));
  }

  getUpcoming(): Observable<Budget | null> {
    return this.budgets$.pipe(map((budgets) => this.upcomingBudget(budgets, new Date())));
  }

  getHistory(): Observable<Budget[]> {
    return this.budgets$.pipe(map((budgets) => this.historyBudgets(budgets, new Date())));
  }

  /** Non-deleted record whose month is the reference's calendar month. */
  currentBudget(budgets: Budget[], reference: Date): Budget | null {
    const target = this.startOfMonth(reference).getTime();
    return budgets.find((budget) => budget.month.getTime() === target) ?? null;
  }

  /** Non-deleted record whose month is the calendar month right after the reference's. */
  upcomingBudget(budgets: Budget[], reference: Date): Budget | null {
    const target = this.addMonths(this.startOfMonth(reference), 1).getTime();
    return budgets.find((budget) => budget.month.getTime() === target) ?? null;
  }

  /** Non-deleted records whose month is before the reference's calendar month, most recent first. */
  historyBudgets(budgets: Budget[], reference: Date): Budget[] {
    const target = this.startOfMonth(reference).getTime();
    return budgets
      .filter((budget) => budget.month.getTime() < target)
      .sort((a, b) => b.month.getTime() - a.month.getTime());
  }

  /** Upserts the budget for the given month — updates the existing non-deleted record for that month if there is one, else creates it. */
  save(month: Date, totalAmount: number, allocations: BudgetAllocation[]): Observable<Budget> {
    const now = new Date();
    const targetMonth = this.startOfMonth(month);
    const existing = this.allSubject.value.find((budget) => !budget.deletedAt && budget.month.getTime() === targetMonth.getTime());

    let saved: Budget;
    let budgets: Budget[];

    if (existing) {
      saved = { ...existing, totalAmount, allocations, updatedAt: now };
      budgets = this.allSubject.value.map((budget) => (budget.id === existing.id ? saved : budget));
    } else {
      saved = {
        id: this.generateId(),
        month: targetMonth,
        totalAmount,
        allocations,
        createdAt: now,
        updatedAt: now
      };
      budgets = [...this.allSubject.value, saved];
    }

    this.persist(budgets);
    this.allSubject.next(budgets);

    return new Observable((subscriber) => {
      subscriber.next(saved);
      subscriber.complete();
    });
  }

  delete(id: string): Observable<void> {
    const now = new Date();
    const budgets = this.allSubject.value.map((budget) =>
      budget.id === id ? { ...budget, deletedAt: now, updatedAt: now } : budget
    );
    this.persist(budgets);
    this.allSubject.next(budgets);

    return new Observable((subscriber) => {
      subscriber.next();
      subscriber.complete();
    });
  }

  /** Suggested monthly amount for one category, derived from its past expense history. */
  suggestMonthlyLimit(transactions: Transaction[], categoryId: string, method: BudgetSuggestMethod, reference: Date): number {
    const categoryExpenses = transactions.filter((t) => t.type === 'expense' && t.categoryId === categoryId);
    if (categoryExpenses.length === 0) return 0;

    if (method === 'avgAll') {
      const months = this.monthlyTotalsSince(categoryExpenses, reference);
      if (months.length === 0) return 0;
      return Math.round(months.reduce((sum, total) => sum + total, 0) / months.length);
    }

    const monthsBack = method === 'lastMonth' ? 1 : method === 'avg3' ? 3 : 6;
    const totals = this.lastNMonthTotals(categoryExpenses, reference, monthsBack);

    if (method === 'lastMonth') return Math.round(totals[totals.length - 1] ?? 0);
    if (method === 'median6') return Math.round(this.median(totals));
    return Math.round(totals.reduce((sum, total) => sum + total, 0) / totals.length);
  }

  /** Plan-vs-actual for a budget against a set of transactions already filtered to its month. */
  budgetProgress(budget: Budget, transactionsThisMonth: Transaction[]): BudgetProgress {
    const expenses = transactionsThisMonth.filter((t) => t.type === 'expense');
    const totalAllocated = budget.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
    const totalSpent = expenses.reduce((sum, t) => sum + t.amount, 0);

    const categories: CategoryProgress[] = budget.allocations.map((allocation) => {
      const spent = expenses
        .filter((t) => t.categoryId === allocation.categoryId)
        .reduce((sum, t) => sum + t.amount, 0);
      return {
        categoryId: allocation.categoryId,
        allocated: allocation.amount,
        spent,
        pct: allocation.amount > 0 ? (spent / allocation.amount) * 100 : null
      };
    });

    return {
      totalAllocated,
      unallocated: budget.totalAmount - totalAllocated,
      totalSpent,
      totalPct: budget.totalAmount > 0 ? (totalSpent / budget.totalAmount) * 100 : null,
      categories
    };
  }

  /**
   * Fills in any calendar months between the latest known record and `reference`'s month by
   * copying forward the latest record's totalAmount/allocations — the "recurring monthly" behavior.
   * If the latest record (deleted or not) is a tombstone, budgeting was explicitly paused there,
   * so no new months are materialized until the user creates one again.
   */
  carryForwardIfNeeded(reference: Date = new Date()): void {
    const all = this.allSubject.value;
    if (all.length === 0) return;

    const latest = [...all].sort((a, b) => b.month.getTime() - a.month.getTime())[0];
    if (latest.deletedAt) return;

    const currentMonth = this.startOfMonth(reference);
    if (latest.month.getTime() >= currentMonth.getTime()) return;

    const now = new Date();
    const newRecords: Budget[] = [];
    let cursor = this.addMonths(latest.month, 1);
    while (cursor.getTime() <= currentMonth.getTime()) {
      newRecords.push({
        id: this.generateId(),
        month: cursor,
        totalAmount: latest.totalAmount,
        allocations: latest.allocations,
        createdAt: now,
        updatedAt: now
      });
      cursor = this.addMonths(cursor, 1);
    }

    if (newRecords.length === 0) return;

    const budgets = [...all, ...newRecords];
    this.persist(budgets);
    this.allSubject.next(budgets);
  }

  /** Totals for each of the `n` calendar months preceding `reference`'s month, oldest first. */
  private lastNMonthTotals(transactions: Transaction[], reference: Date, n: number): number[] {
    const totals: number[] = [];
    for (let i = n; i >= 1; i--) {
      const start = new Date(reference.getFullYear(), reference.getMonth() - i, 1);
      const end = new Date(reference.getFullYear(), reference.getMonth() - i + 1, 0, 23, 59, 59, 999);
      totals.push(transactions.filter((t) => t.date >= start && t.date <= end).reduce((sum, t) => sum + t.amount, 0));
    }
    return totals;
  }

  /** Totals for every calendar month from the earliest transaction's month through the month before `reference`. */
  private monthlyTotalsSince(transactions: Transaction[], reference: Date): number[] {
    const earliest = transactions.reduce((min, t) => (t.date < min ? t.date : min), transactions[0].date);
    let cursor = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
    const last = new Date(reference.getFullYear(), reference.getMonth() - 1, 1);
    if (cursor.getTime() > last.getTime()) return [];

    const totals: number[] = [];
    while (cursor.getTime() <= last.getTime()) {
      const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
      totals.push(transactions.filter((t) => t.date >= start && t.date <= end).reduce((sum, t) => sum + t.amount, 0));
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    return totals;
  }

  private median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  private startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private addMonths(date: Date, n: number): Date {
    return new Date(date.getFullYear(), date.getMonth() + n, 1);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}
