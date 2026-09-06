import { Injectable } from '@angular/core';
import { combineLatest } from 'rxjs';
import { MessageService } from 'primeng/api';
import { BudgetService } from './budget.service';
import { TransactionService } from './transaction.service';
import { CategoryService } from './category.service';
import { DashboardService } from './dashboard.service';
import { PeriodSettingsService } from './period-settings.service';
import { BUDGET_OVER_THRESHOLD, BUDGET_WARN_THRESHOLD } from '../core/types/budget.types';
import { Category } from '../core/types/category.types';

const STORAGE_KEY = 'budgetAlertsSeen';

@Injectable({
  providedIn: 'root'
})
export class BudgetAlertService {
  private readonly seen: Set<string> = this.loadSeen();

  constructor(
    private readonly budgetService: BudgetService,
    private readonly transactionService: TransactionService,
    private readonly categoryService: CategoryService,
    private readonly dashboardService: DashboardService,
    private readonly periodSettingsService: PeriodSettingsService,
    private readonly messageService: MessageService
  ) {
    combineLatest([this.budgetService.getCurrent(), this.transactionService.getAll(), this.categoryService.getAll()]).subscribe(
      ([budget, transactions, categories]) => {
        if (!budget) return;

        const range = this.dashboardService.rangeForPreset(
          'thisMonth',
          new Date(),
          transactions,
          null,
          this.periodSettingsService.getStartDay(),
          this.periodSettingsService.getStartHour()
        );
        const thisMonth = this.dashboardService.transactionsInPeriod(transactions, range);
        const progress = this.budgetService.budgetProgress(budget, thisMonth);

        this.checkAndAlert(budget.id, 'total', progress.totalPct, {
          over: 'Superaste tu presupuesto total',
          warn: 'de tu presupuesto total'
        });
        for (const category of progress.categories) {
          const name = categories.find((cat: Category) => cat.id === category.categoryId)?.name ?? 'una categoría';
          this.checkAndAlert(budget.id, category.categoryId, category.pct, {
            over: `Superaste el presupuesto de "${name}"`,
            warn: `del presupuesto de "${name}"`
          });
        }
      }
    );
  }

  private checkAndAlert(budgetId: string, key: string, pct: number | null, phrasing: { over: string; warn: string }): void {
    if (pct === null) return;

    if (pct >= BUDGET_OVER_THRESHOLD) {
      this.fireOnce(
        `${budgetId}:${key}:${BUDGET_OVER_THRESHOLD}`,
        'error',
        'Presupuesto superado',
        `${phrasing.over} (${Math.round(pct)}%).`
      );
    } else if (pct >= BUDGET_WARN_THRESHOLD) {
      this.fireOnce(
        `${budgetId}:${key}:${BUDGET_WARN_THRESHOLD}`,
        'warn',
        'Cerca del límite',
        `Ya usaste el ${Math.round(pct)}% ${phrasing.warn}.`
      );
    }
  }

  private fireOnce(key: string, severity: 'warn' | 'error', summary: string, detail: string): void {
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.persistSeen();
    this.messageService.add({ severity, summary, detail });
  }

  private loadSeen(): Set<string> {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const keys: string[] = JSON.parse(raw);
    return new Set(keys);
  }

  private persistSeen(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.seen]));
  }
}
