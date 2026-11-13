import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, combineLatest, lastValueFrom } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { ConfirmationService, MessageService } from 'primeng/api';

import { SavingsPlan, SavingsPlanSummary, SavingsTrendPoint } from '../../core/types/savings-plan.types';
import { Category } from '../../core/types/category.types';
import { SavingsPlanService, DEFAULT_SAVINGS_TARGET_PCT } from '../../services/savings-plan.service';
import { BudgetService } from '../../services/budget.service';
import { TransactionService } from '../../services/transaction.service';
import { CategoryService } from '../../services/category.service';
import { IconComponent } from '../../shared/icon/icon.component';

interface SavingsRowDisplay {
  categoryId: string;
  name: string;
  color: string;
  icon: string;
  planned: number | null;
  actual: number;
  pct: number | null;
}

const TREND_PERIODS = 6;

@Component({
  selector: 'app-savings-plan',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, DialogModule, InputNumberModule, IconComponent],
  templateUrl: './savings-plan.page.html',
  styleUrl: './savings-plan.page.scss'
})
export class SavingsPlanPage implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  plan: SavingsPlan | null = null;
  summary: SavingsPlanSummary | null = null;
  rows: SavingsRowDisplay[] = [];
  trend: SavingsTrendPoint[] = [];

  dialogVisible = false;
  formTargetPct: number | null = DEFAULT_SAVINGS_TARGET_PCT;
  formIncome: number | null = null;

  constructor(
    private readonly savingsPlanService: SavingsPlanService,
    private readonly budgetService: BudgetService,
    private readonly transactionService: TransactionService,
    private readonly categoryService: CategoryService,
    private readonly confirmationService: ConfirmationService,
    private readonly messageService: MessageService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    combineLatest([
      this.savingsPlanService.getPlan(),
      this.budgetService.getAll(),
      this.transactionService.getAll(),
      this.categoryService.getAll()
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([plan, budgets, transactions, categories]) => {
        const reference = new Date();
        this.plan = plan;

        if (!plan) {
          this.summary = null;
          this.rows = [];
          this.trend = [];
        } else {
          const budget = this.budgetService.currentBudget(budgets, reference);
          this.summary = this.savingsPlanService.summarize(plan, transactions, budget, reference);
          this.rows = this.buildRows(this.summary, categories);
          this.trend = this.savingsPlanService.periodTrend(transactions, reference, TREND_PERIODS);
        }

        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get onTarget(): boolean {
    return this.summary !== null && this.summary.buffer >= 0;
  }

  get spentPct(): number {
    if (!this.summary || this.summary.ticket <= 0) return this.summary && this.summary.spent > 0 ? 100 : 0;
    return Math.min((this.summary.spent / this.summary.ticket) * 100, 100);
  }

  trendBarHeight(point: SavingsTrendPoint): number {
    if (point.savedPct === null) return 0;
    return Math.max(0, Math.min(point.savedPct, 100));
  }

  trendMetTarget(point: SavingsTrendPoint): boolean {
    return point.savedPct !== null && this.plan !== null && point.savedPct >= this.plan.targetPct;
  }

  openDialog(): void {
    this.formTargetPct = this.plan?.targetPct ?? DEFAULT_SAVINGS_TARGET_PCT;
    this.formIncome = this.plan?.incomeOverride ?? null;
    this.dialogVisible = true;
  }

  async savePlan(): Promise<void> {
    if (this.formTargetPct === null || this.formTargetPct <= 0 || this.formTargetPct >= 100) {
      this.messageService.add({ severity: 'warn', summary: 'Porcentaje inválido', detail: 'Ingresá un valor entre 1 y 99' });
      return;
    }

    if (this.formIncome !== null && this.formIncome <= 0) {
      this.messageService.add({ severity: 'warn', summary: 'Ingreso inválido', detail: 'Dejalo vacío para usar el promedio' });
      return;
    }

    await lastValueFrom(this.savingsPlanService.save(this.formTargetPct, this.formIncome));
    this.messageService.add({ severity: 'success', summary: 'Plan de ahorro guardado' });
    this.dialogVisible = false;
  }

  confirmDelete(): void {
    this.confirmationService.confirm({
      message: '¿Eliminar el plan de ahorro?',
      header: 'Eliminar plan',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      accept: async () => {
        await lastValueFrom(this.savingsPlanService.delete());
        this.messageService.add({ severity: 'success', summary: 'Plan eliminado' });
      }
    });
  }

  private buildRows(summary: SavingsPlanSummary, categories: Category[]): SavingsRowDisplay[] {
    return summary.rows.map((row) => {
      const category = categories.find((cat) => cat.id === row.categoryId);
      return {
        categoryId: row.categoryId,
        name: category?.name ?? 'Sin categoría',
        color: category?.color ?? '#64748b',
        icon: category?.icon ?? 'tag',
        planned: row.planned,
        actual: row.actual,
        pct: row.planned !== null && row.planned > 0 ? (row.actual / row.planned) * 100 : null
      };
    });
  }
}
