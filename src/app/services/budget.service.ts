import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map, lastValueFrom } from 'rxjs';
import {
  Budget,
  BudgetAllocation,
  BudgetGoalAllocation,
  BudgetProgress,
  BudgetSuggestMethod,
  CategoryProgress,
  GoalAllocationResolution,
  PendingGoalRollover
} from '../core/types/budget.types';
import { Transaction } from '../core/types/transaction.types';
import { Category } from '../core/types/category.types';
import { Goal } from '../core/types/goal.types';
import { periodLabelMonth, addMonths } from '../core/utils/period.util';
import { formatMonthLabel } from '../core/utils/date-display.util';
import { PeriodSettingsService } from './period-settings.service';
import { DashboardService } from './dashboard.service';
import { AccountService } from './account.service';
import { GoalService } from './goal.service';

export interface StoredBudget extends Omit<Budget, 'month' | 'createdAt' | 'updatedAt' | 'deletedAt'> {
  month: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export function toBudget(stored: StoredBudget): Budget {
  return {
    ...stored,
    goalAllocations: stored.goalAllocations ?? [],
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

export interface BudgetFormRow {
  categoryId: string;
  name: string;
  color: string;
  icon: string;
  historicalTotal: number;
  included: boolean;
  amount: number | null;
}

export interface BudgetFormGoalRow {
  goalId: string;
  name: string;
  color: string;
  icon: string;
  included: boolean;
  amount: number | null;
  accountId: string | null;
}

export interface RolloverForm {
  action: GoalAllocationResolution;
  sourceAccountId: string | null;
  destinationAccountId: string | null;
}

export type BudgetSaveOutcome = { status: 'invalid'; summary: string; detail?: string } | { status: 'saved' };

export type RolloverResolutionOutcome = { status: 'invalid'; summary: string } | { status: 'resolved' };

@Injectable({
  providedIn: 'root'
})
export class BudgetService {
  private readonly storageKey = 'budgets';
  private readonly allSubject = new BehaviorSubject<Budget[]>(this.loadAll());
  readonly budgets$: Observable<Budget[]> = this.allSubject.pipe(map((budgets) => budgets.filter((budget) => !budget.deletedAt)));

  constructor(
    private readonly periodSettings: PeriodSettingsService,
    private readonly dashboardService: DashboardService,
    private readonly accountService: AccountService,
    private readonly goalService: GoalService
  ) {
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

  /** Non-deleted record whose month labels the period `reference` falls in (see period.util). */
  currentBudget(budgets: Budget[], reference: Date): Budget | null {
    const target = periodLabelMonth(reference, this.periodSettings.getStartDay()).getTime();
    return budgets.find((budget) => budget.month.getTime() === target) ?? null;
  }

  /** Non-deleted record whose month is the label right after the reference's period. */
  upcomingBudget(budgets: Budget[], reference: Date): Budget | null {
    const target = addMonths(periodLabelMonth(reference, this.periodSettings.getStartDay()), 1).getTime();
    return budgets.find((budget) => budget.month.getTime() === target) ?? null;
  }

  /** Non-deleted records whose month is before the reference's period label, most recent first. */
  historyBudgets(budgets: Budget[], reference: Date): Budget[] {
    const target = periodLabelMonth(reference, this.periodSettings.getStartDay()).getTime();
    return budgets
      .filter((budget) => budget.month.getTime() < target)
      .sort((a, b) => b.month.getTime() - a.month.getTime());
  }

  /** One form row per expense category, pre-checked/pre-filled from any existing allocation, sorted by historical spend descending. */
  buildAllocationRows(expenseCategories: Category[], transactions: Transaction[], existing: BudgetAllocation[]): BudgetFormRow[] {
    return expenseCategories
      .map((cat) => {
        const historicalTotal = transactions
          .filter((t) => t.type === 'expense' && t.categoryId === cat.id)
          .reduce((sum, t) => sum + t.amount, 0);
        const existingAllocation = existing.find((allocation) => allocation.categoryId === cat.id);

        return {
          categoryId: cat.id,
          name: cat.name,
          color: cat.color,
          icon: cat.icon,
          historicalTotal,
          included: !!existingAllocation,
          amount: existingAllocation?.amount ?? null
        };
      })
      .sort((a, b) => b.historicalTotal - a.historicalTotal);
  }

  /** One form row per goal, pre-checked/pre-filled from any existing goal allocation. */
  buildGoalRows(goals: Goal[], existing: BudgetGoalAllocation[]): BudgetFormGoalRow[] {
    return goals.map((goal) => {
      const existingAllocation = existing.find((allocation) => allocation.goalId === goal.id);
      return {
        goalId: goal.id,
        name: goal.name,
        color: goal.color,
        icon: goal.icon,
        included: !!existingAllocation,
        amount: existingAllocation?.amount ?? null,
        accountId: existingAllocation?.accountId ?? null
      };
    });
  }

  /** This-month and next-month options, plus `preferred` itself when it's neither (e.g. the period start day changed since a budget was saved for a now-unreachable month). */
  buildTargetMonthOptions(preferred: Date, reference: Date = new Date()): { label: string; value: Date }[] {
    const current = periodLabelMonth(reference, this.periodSettings.getStartDay());
    const next = addMonths(current, 1);
    const options = [
      { label: `${formatMonthLabel(current)} (este mes)`, value: current },
      { label: `${formatMonthLabel(next)} (el mes que viene)`, value: next }
    ];

    if (!options.some((opt) => opt.value.getTime() === preferred.getTime())) {
      options.push({ label: formatMonthLabel(preferred), value: preferred });
    }

    return options;
  }

  /** Upserts the budget for the given month — updates the existing non-deleted record for that month if there is one, else creates it. */
  save(month: Date, totalAmount: number, allocations: BudgetAllocation[], goalAllocations: BudgetGoalAllocation[] = []): Observable<Budget> {
    const now = new Date();
    const targetMonth = this.startOfMonth(month);
    const existing = this.allSubject.value.find((budget) => !budget.deletedAt && budget.month.getTime() === targetMonth.getTime());

    let saved: Budget;
    let budgets: Budget[];

    if (existing) {
      saved = { ...existing, totalAmount, allocations, goalAllocations, updatedAt: now };
      budgets = this.allSubject.value.map((budget) => (budget.id === existing.id ? saved : budget));
    } else {
      saved = {
        id: this.generateId(),
        month: targetMonth,
        totalAmount,
        allocations,
        goalAllocations,
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

  /** Validates the budget form rows and saves them, or reports why the save was rejected. */
  async saveFromRows(
    targetMonth: Date,
    totalAmount: number | null,
    rows: BudgetFormRow[],
    goalRows: BudgetFormGoalRow[]
  ): Promise<BudgetSaveOutcome> {
    if (totalAmount === null || totalAmount <= 0) {
      return { status: 'invalid', summary: 'Ingresá un monto total válido' };
    }

    const included = rows.filter((row) => row.included);
    if (included.some((row) => row.amount === null || row.amount < 0)) {
      return {
        status: 'invalid',
        summary: 'Montos incompletos',
        detail: 'Completá un monto válido para cada categoría seleccionada'
      };
    }

    const includedGoals = goalRows.filter((row) => row.included);
    if (includedGoals.some((row) => row.amount === null || row.amount <= 0 || !row.accountId)) {
      return {
        status: 'invalid',
        summary: 'Metas incompletas',
        detail: 'Completá cuenta de origen y un monto válido para cada meta seleccionada'
      };
    }

    const categorySum = included.reduce((sum, row) => sum + (row.amount ?? 0), 0);
    const goalSum = includedGoals.reduce((sum, row) => sum + (row.amount ?? 0), 0);
    if (categorySum + goalSum > totalAmount) {
      return {
        status: 'invalid',
        summary: 'Presupuesto sobreasignado',
        detail: 'La suma de las categorías y metas supera el monto total'
      };
    }

    const allocations: BudgetAllocation[] = included.map((row) => ({ categoryId: row.categoryId, amount: row.amount! }));
    const goalAllocations: BudgetGoalAllocation[] = includedGoals.map((row) => ({
      goalId: row.goalId,
      accountId: row.accountId!,
      amount: row.amount!
    }));

    await lastValueFrom(this.save(targetMonth, totalAmount, allocations, goalAllocations));
    return { status: 'saved' };
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
    const categoryAllocated = budget.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
    const goalAllocated = budget.goalAllocations.reduce((sum, allocation) => sum + allocation.amount, 0);
    const totalAllocated = categoryAllocated + goalAllocated;
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
      categories,
      goals: budget.goalAllocations.map(({ goalId, amount }) => ({ goalId, amount }))
    };
  }

  /** Plan-vs-actual for `budget` against the current nominal period, filtering `transactions` down to it first. Null when there's no active budget. */
  currentPeriodProgress(budget: Budget | null, transactions: Transaction[]): BudgetProgress | null {
    if (!budget) return null;

    const range = this.dashboardService.rangeForPreset(
      'thisMonth',
      new Date(),
      transactions,
      null,
      this.periodSettings.getStartDay(),
      this.periodSettings.getStartHour()
    );
    const thisMonth = this.dashboardService.transactionsInPeriod(transactions, range);
    return this.budgetProgress(budget, thisMonth);
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

    const currentMonth = periodLabelMonth(reference, this.periodSettings.getStartDay());
    if (latest.month.getTime() >= currentMonth.getTime()) return;

    const now = new Date();
    const newRecords: Budget[] = [];
    let cursor = addMonths(latest.month, 1);
    while (cursor.getTime() <= currentMonth.getTime()) {
      newRecords.push({
        id: this.generateId(),
        month: cursor,
        totalAmount: latest.totalAmount,
        allocations: latest.allocations,
        goalAllocations: latest.goalAllocations.map(({ goalId, accountId, amount }) => ({ goalId, accountId, amount })),
        createdAt: now,
        updatedAt: now
      });
      cursor = addMonths(cursor, 1);
    }

    if (newRecords.length === 0) return;

    const budgets = [...all, ...newRecords];
    this.persist(budgets);
    this.allSubject.next(budgets);
  }

  /** Unresolved goal allocations belonging to non-deleted budgets whose month has already passed. */
  pendingGoalRollovers(budgets: Budget[], reference: Date): PendingGoalRollover[] {
    const result: PendingGoalRollover[] = [];
    for (const budget of this.historyBudgets(budgets, reference)) {
      for (const allocation of budget.goalAllocations) {
        if (!allocation.resolution) result.push({ budget, allocation });
      }
    }
    return result;
  }

  /** Records what actually happened to a goal allocation's money once its month rolled over. Pure data mutation — no Account/Goal side effects (the caller performs those first). */
  markGoalAllocationResolved(
    budgetId: string,
    goalId: string,
    resolution: GoalAllocationResolution,
    resolvedAccountId: string,
    destinationAccountId?: string
  ): Observable<void> {
    const budgets = this.allSubject.value.map((budget) => {
      if (budget.id !== budgetId) return budget;
      return {
        ...budget,
        goalAllocations: budget.goalAllocations.map((allocation) =>
          allocation.goalId === goalId ? { ...allocation, resolution, resolvedAccountId, destinationAccountId } : allocation
        ),
        updatedAt: new Date()
      };
    });
    this.persist(budgets);
    this.allSubject.next(budgets);

    return new Observable((subscriber) => {
      subscriber.next();
      subscriber.complete();
    });
  }

  /** Applies a pending goal rollover's chosen resolution (kept/transferred/saved) — the account/goal side effects, then marks the allocation resolved. */
  async resolveRollover(pending: PendingGoalRollover, form: RolloverForm): Promise<RolloverResolutionOutcome> {
    const { action, sourceAccountId, destinationAccountId } = form;
    const { budget, allocation } = pending;

    if (action !== 'kept' && !sourceAccountId) {
      return { status: 'invalid', summary: 'Elegí de qué cuenta sale el dinero' };
    }
    if (action === 'transferred' && (!destinationAccountId || destinationAccountId === sourceAccountId)) {
      return { status: 'invalid', summary: 'Elegí una cuenta de destino distinta' };
    }

    const goalName = this.goalService.getAllIncludingDeleted().find((goal) => goal.id === allocation.goalId)?.name ?? 'Meta eliminada';
    const description = `Rollover presupuesto ${formatMonthLabel(budget.month)} — ${goalName}`;

    if (action === 'transferred') {
      await lastValueFrom(
        this.accountService.transfer(sourceAccountId!, destinationAccountId!, allocation.amount, new Date(), description)
      );
    } else if (action === 'saved') {
      this.accountService.adjustBalance(sourceAccountId!, -allocation.amount);
      await lastValueFrom(this.goalService.contribute(allocation.goalId, allocation.amount, new Date(), description));
    }

    await lastValueFrom(
      this.markGoalAllocationResolved(
        budget.id,
        allocation.goalId,
        action,
        action === 'kept' ? allocation.accountId : sourceAccountId!,
        action === 'transferred' ? destinationAccountId! : undefined
      )
    );

    return { status: 'resolved' };
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

  /** Plain calendar day-1 normalization — only for values that are already a period label (see period.util's periodLabelMonth for real dates). */
  private startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}
