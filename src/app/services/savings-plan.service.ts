import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map, of } from 'rxjs';
import { SavingsPlan, SavingsPlanCategoryRow, SavingsPlanSummary, SavingsTrendPoint } from '../core/types/savings-plan.types';
import { Budget } from '../core/types/budget.types';
import { Transaction } from '../core/types/transaction.types';
import { addMonths, periodHistory, periodLabelMonth, periodRange } from '../core/utils/period.util';
import { currentTargetPct, targetForPeriod, withTarget } from '../core/utils/savings-target.util';
import { formatMonthLabel } from '../core/utils/date-display.util';
import { DashboardService } from './dashboard.service';
import { PeriodSettingsService } from './period-settings.service';

export const SAVINGS_PLAN_ID = 'savings-plan';
export const DEFAULT_SAVINGS_TARGET_PCT = 80;
const INCOME_AVERAGE_PERIODS = 3;

export interface StoredSavingsTarget {
  from: string;
  pct: number;
}

export interface StoredSavingsPlan extends Omit<SavingsPlan, 'targets' | 'createdAt' | 'updatedAt' | 'deletedAt'> {
  targets: StoredSavingsTarget[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

/** Shape stored before targets became period-scoped; only read by the one-time migration in SavingsPlanService. */
interface LegacyStoredSavingsPlan extends Omit<StoredSavingsPlan, 'targets'> {
  targetPct: number;
}

export function toSavingsPlan(stored: StoredSavingsPlan): SavingsPlan {
  return {
    ...stored,
    targets: stored.targets.map((target) => ({ from: new Date(target.from), pct: target.pct })),
    createdAt: new Date(stored.createdAt),
    updatedAt: new Date(stored.updatedAt),
    deletedAt: stored.deletedAt ? new Date(stored.deletedAt) : undefined
  };
}

export function fromSavingsPlan(plan: SavingsPlan): StoredSavingsPlan {
  return {
    ...plan,
    targets: plan.targets.map((target) => ({ from: target.from.toISOString(), pct: target.pct })),
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
    deletedAt: plan.deletedAt ? plan.deletedAt.toISOString() : undefined
  };
}

@Injectable({
  providedIn: 'root'
})
export class SavingsPlanService {
  private readonly storageKey = 'savings_plans';
  private readonly allSubject = new BehaviorSubject<SavingsPlan[]>(this.loadAll());
  readonly plan$: Observable<SavingsPlan | null> = this.allSubject.pipe(
    map((plans) => plans.find((plan) => plan.id === SAVINGS_PLAN_ID && !plan.deletedAt) ?? null)
  );

  constructor(
    private readonly dashboardService: DashboardService,
    private readonly periodSettings: PeriodSettingsService
  ) {}

  private loadAll(): SavingsPlan[] {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) return [];
    const stored: (StoredSavingsPlan | LegacyStoredSavingsPlan)[] = JSON.parse(raw);
    const migrated = stored.map((plan) => ('targets' in plan ? plan : this.migrateLegacyPlan(plan)));
    if (migrated.some((plan, index) => plan !== stored[index])) {
      localStorage.setItem(this.storageKey, JSON.stringify(migrated));
    }
    return migrated.map((plan) => toSavingsPlan(plan));
  }

  /** The legacy single target applied to the whole plan; carry it forward from the month the plan was created. */
  private migrateLegacyPlan(legacy: LegacyStoredSavingsPlan): StoredSavingsPlan {
    const { targetPct, ...rest } = legacy;
    const created = new Date(legacy.createdAt);
    const from = new Date(created.getFullYear(), created.getMonth(), 1).toISOString();
    return { ...rest, targets: [{ from, pct: targetPct }] };
  }

  private persist(plans: SavingsPlan[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(plans.map((plan) => fromSavingsPlan(plan))));
  }

  getPlan(): Observable<SavingsPlan | null> {
    return this.plan$;
  }

  getAllIncludingDeleted(): SavingsPlan[] {
    return this.allSubject.value;
  }

  replaceAll(plans: SavingsPlan[]): void {
    this.persist(plans);
    this.allSubject.next(plans);
  }

  /** A changed target applies from `reference`'s period onward; earlier periods keep the target they had. */
  save(targetPct: number, incomeOverride: number | null, reference: Date = new Date()): Observable<SavingsPlan> {
    const now = new Date();
    const existing = this.allSubject.value.find((plan) => plan.id === SAVINGS_PLAN_ID && !plan.deletedAt);
    const labelMonth = periodLabelMonth(reference, this.periodSettings.getStartDay());
    const saved: SavingsPlan = {
      id: SAVINGS_PLAN_ID,
      targets: withTarget(existing?.targets ?? [], targetPct, labelMonth),
      incomeOverride: incomeOverride ?? undefined,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };

    const others = this.allSubject.value.filter((plan) => plan.id !== SAVINGS_PLAN_ID);
    const plans = [...others, saved];
    this.persist(plans);
    this.allSubject.next(plans);
    return of(saved);
  }

  delete(): Observable<void> {
    const now = new Date();
    const plans = this.allSubject.value.map((plan) => (plan.id === SAVINGS_PLAN_ID ? { ...plan, deletedAt: now, updatedAt: now } : plan));
    this.persist(plans);
    this.allSubject.next(plans);
    return of(undefined);
  }

  /** Plan-vs-actual for the period containing `reference`. Income is the override, else the average of up to 3 prior periods, else this period's own income. */
  summarize(
    plan: SavingsPlan,
    transactions: Transaction[],
    budget: Budget | null,
    reference: Date
  ): SavingsPlanSummary {
    const startDay = this.periodSettings.getStartDay();
    const startHour = this.periodSettings.getStartHour();

    const currentRange = periodRange(reference, startDay, startHour, transactions);
    const current = this.dashboardService.transactionsInPeriod(transactions, currentRange);
    const currentStats = this.dashboardService.periodStats(current);

    const priorIncomes = this.priorPeriodIncomes(transactions, reference, startDay, startHour);
    const estimated = priorIncomes.length > 0 ? priorIncomes.reduce((sum, value) => sum + value, 0) / priorIncomes.length : currentStats.income;
    const income = plan.incomeOverride ?? estimated;

    const targetPct = currentTargetPct(plan);
    const savingsGoal = (income * targetPct) / 100;
    const ticket = income - savingsGoal;
    const saved = income - currentStats.expense;
    const savedPct = income > 0 ? (saved / income) * 100 : null;

    return {
      income,
      incomeIsEstimate: plan.incomeOverride === undefined,
      targetPct,
      savingsGoal,
      ticket,
      spent: currentStats.expense,
      saved,
      savedPct,
      buffer: ticket - currentStats.expense,
      bufferPct: savedPct === null ? null : savedPct - targetPct,
      budgetTotal: budget ? budget.totalAmount : null,
      rows: this.categoryRows(current, budget)
    };
  }

  /** Saved % for each of the last `count` periods (current included), oldest first, each against the target that was in force then. */
  periodTrend(plan: SavingsPlan | null, transactions: Transaction[], reference: Date, count: number): SavingsTrendPoint[] {
    const startDay = this.periodSettings.getStartDay();
    const startHour = this.periodSettings.getStartHour();

    return periodHistory(addMonths(reference, -(count - 1)), reference, startDay, startHour, transactions).map((occurrence) => {
      const labelMonth = periodLabelMonth(occurrence.start, startDay);
      const stats = this.dashboardService.periodStats(this.dashboardService.transactionsInPeriod(transactions, occurrence));
      return {
        label: formatMonthLabel(labelMonth),
        income: stats.income,
        expense: stats.expense,
        savedPct: stats.savingsRate,
        targetPct: plan ? targetForPeriod(plan, labelMonth) : null
      };
    });
  }

  private priorPeriodIncomes(transactions: Transaction[], reference: Date, startDay: number, startHour: number): number[] {
    const prior = periodHistory(addMonths(reference, -INCOME_AVERAGE_PERIODS), addMonths(reference, -1), startDay, startHour, transactions);
    return prior
      .map((occurrence) => this.dashboardService.periodStats(this.dashboardService.transactionsInPeriod(transactions, occurrence)).income)
      .filter((income) => income > 0);
  }

  private categoryRows(periodTransactions: Transaction[], budget: Budget | null): SavingsPlanCategoryRow[] {
    const actual = new Map<string, number>();
    for (const txn of periodTransactions) {
      if (txn.type !== 'expense') continue;
      actual.set(txn.categoryId, (actual.get(txn.categoryId) ?? 0) + txn.amount);
    }

    const planned = new Map<string, number>((budget?.allocations ?? []).map((allocation) => [allocation.categoryId, allocation.amount]));
    const ids = new Set([...actual.keys(), ...planned.keys()]);

    return Array.from(ids)
      .map((categoryId) => ({
        categoryId,
        planned: planned.get(categoryId) ?? null,
        actual: actual.get(categoryId) ?? 0
      }))
      .sort((a, b) => b.actual - a.actual || (b.planned ?? 0) - (a.planned ?? 0));
  }
}
