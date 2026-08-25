import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, combineLatest, lastValueFrom } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmationService, MessageService } from 'primeng/api';

import {
  Budget,
  BudgetAllocation,
  BudgetGoalAllocation,
  BudgetProgress,
  BudgetSuggestMethod,
  GoalAllocationResolution,
  PendingGoalRollover
} from '../../core/types/budget.types';
import { Category } from '../../core/types/category.types';
import { Transaction } from '../../core/types/transaction.types';
import { Goal } from '../../core/types/goal.types';
import { Account } from '../../core/types/account.types';
import { BudgetService } from '../../services/budget.service';
import { CategoryService } from '../../services/category.service';
import { TransactionService } from '../../services/transaction.service';
import { GoalService } from '../../services/goal.service';
import { AccountService } from '../../services/account.service';
import { DashboardService } from '../../services/dashboard.service';
import { PeriodSettingsService } from '../../services/period-settings.service';
import { periodLabelMonth, periodRange, addMonths } from '../../core/utils/period.util';
import { IconComponent } from '../../shared/icon/icon.component';
import { BudgetProgressComponent } from '../../shared/budget-progress/budget-progress.component';
import { PeriodStartDayComponent } from '../../shared/period-start-day/period-start-day.component';

interface BudgetFormRow {
  categoryId: string;
  name: string;
  color: string;
  icon: string;
  historicalTotal: number;
  included: boolean;
  amount: number | null;
}

interface BudgetFormGoalRow {
  goalId: string;
  name: string;
  color: string;
  icon: string;
  included: boolean;
  amount: number | null;
  accountId: string | null;
}

interface RolloverForm {
  action: GoalAllocationResolution;
  sourceAccountId: string | null;
  destinationAccountId: string | null;
}

const EMPTY_ROLLOVER_FORM: RolloverForm = {
  action: 'saved',
  sourceAccountId: null,
  destinationAccountId: null
};

@Component({
  selector: 'app-budgets',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    InputNumberModule,
    SelectModule,
    CheckboxModule,
    IconComponent,
    BudgetProgressComponent,
    PeriodStartDayComponent
  ],
  templateUrl: './budgets.page.html',
  styleUrl: './budgets.page.scss'
})
export class BudgetsPage implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private budgets: Budget[] = [];

  categories: Category[] = [];
  expenseCategories: Category[] = [];
  allTransactions: Transaction[] = [];
  goals: Goal[] = [];
  accounts: Account[] = [];

  current: Budget | null = null;
  upcoming: Budget | null = null;
  progress: BudgetProgress | null = null;
  history: Budget[] = [];
  historyPanelOpen = false;
  pendingRollovers: PendingGoalRollover[] = [];

  readonly suggestMethodOptions: { label: string; value: BudgetSuggestMethod }[] = [
    { label: 'Mes pasado', value: 'lastMonth' },
    { label: 'Promedio 3 meses', value: 'avg3' },
    { label: 'Promedio histórico', value: 'avgAll' },
    { label: 'Mediana 6 meses', value: 'median6' }
  ];

  dialogVisible = false;
  targetMonth: Date = new Date();
  targetMonthOptions: { label: string; value: Date }[] = [];
  totalAmount: number | null = null;
  suggestMethod: BudgetSuggestMethod = 'avg3';
  minSpendFilter: number | null = 0;
  rows: BudgetFormRow[] = [];
  goalRows: BudgetFormGoalRow[] = [];

  rolloverDialogVisible = false;
  resolvingRollover: PendingGoalRollover | null = null;
  rolloverForm: RolloverForm = { ...EMPTY_ROLLOVER_FORM };

  readonly rolloverActionOptions: { label: string; value: GoalAllocationResolution }[] = [
    { label: 'Dejar en la cuenta', value: 'kept' },
    { label: 'Mover a otra cuenta', value: 'transferred' },
    { label: 'Ahorrar en la meta', value: 'saved' }
  ];

  periodStartDay = 1;
  periodStartHour = 0;
  currentPeriodRange: { start: Date; end: Date } | null = null;

  constructor(
    private readonly budgetService: BudgetService,
    private readonly categoryService: CategoryService,
    private readonly transactionService: TransactionService,
    private readonly goalService: GoalService,
    private readonly accountService: AccountService,
    private readonly dashboardService: DashboardService,
    private readonly periodSettingsService: PeriodSettingsService,
    private readonly confirmationService: ConfirmationService,
    private readonly messageService: MessageService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.periodStartDay = this.periodSettingsService.getStartDay();
    this.periodStartHour = this.periodSettingsService.getStartHour();

    combineLatest([
      this.budgetService.getAll(),
      this.transactionService.getAll(),
      this.categoryService.getAll(),
      this.goalService.getAll(),
      this.accountService.getAll()
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([budgets, transactions, categories, goals, accounts]) => {
        const reference = new Date();
        this.budgets = budgets;
        this.categories = categories;
        this.expenseCategories = categories.filter((cat) => cat.type === 'expense');
        this.allTransactions = transactions;
        this.goals = goals;
        this.accounts = accounts;
        this.current = this.budgetService.currentBudget(budgets, reference);
        this.upcoming = this.budgetService.upcomingBudget(budgets, reference);
        this.history = this.budgetService.historyBudgets(budgets, reference);
        this.pendingRollovers = this.budgetService.pendingGoalRollovers(budgets, reference);
        this.currentPeriodRange = periodRange(reference, this.periodStartDay, this.periodStartHour, transactions);

        if (this.current) {
          const range = this.dashboardService.rangeForPreset(
            'thisMonth',
            reference,
            transactions,
            null,
            this.periodStartDay,
            this.periodStartHour
          );
          const thisMonth = this.dashboardService.transactionsInPeriod(transactions, range);
          this.progress = this.budgetService.budgetProgress(this.current, thisMonth);
        } else {
          this.progress = null;
        }

        this.cdr.markForCheck();
      });
  }

  onPeriodSettingsChange(): void {
    this.periodStartDay = this.periodSettingsService.getStartDay();
    this.periodStartHour = this.periodSettingsService.getStartHour();
    const reference = new Date();
    this.current = this.budgetService.currentBudget(this.budgets, reference);
    this.upcoming = this.budgetService.upcomingBudget(this.budgets, reference);
    this.history = this.budgetService.historyBudgets(this.budgets, reference);
    this.currentPeriodRange = periodRange(reference, this.periodStartDay, this.periodStartHour, this.allTransactions);

    if (this.current) {
      const range = this.dashboardService.rangeForPreset(
        'thisMonth',
        reference,
        this.allTransactions,
        null,
        this.periodStartDay,
        this.periodStartHour
      );
      const thisMonth = this.dashboardService.transactionsInPeriod(this.allTransactions, range);
      this.progress = this.budgetService.budgetProgress(this.current, thisMonth);
    } else {
      this.progress = null;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get visibleRows(): BudgetFormRow[] {
    const min = this.minSpendFilter ?? 0;
    return this.rows.filter((row) => row.included || row.historicalTotal >= min);
  }

  get allocatedSum(): number {
    const categorySum = this.rows.filter((row) => row.included).reduce((sum, row) => sum + (row.amount ?? 0), 0);
    const goalSum = this.goalRows.filter((row) => row.included).reduce((sum, row) => sum + (row.amount ?? 0), 0);
    return categorySum + goalSum;
  }

  get remaining(): number {
    return (this.totalAmount ?? 0) - this.allocatedSum;
  }

  private currentMonthStart(): Date {
    return periodLabelMonth(new Date(), this.periodStartDay);
  }

  private nextMonthStart(): Date {
    return addMonths(this.currentMonthStart(), 1);
  }

  openPlanNextMonthDialog(): void {
    this.openFormDialog(this.upcoming ? this.upcoming.month : this.nextMonthStart(), this.upcoming);
  }

  openEditCurrentDialog(): void {
    if (!this.current) return;
    this.openFormDialog(this.current.month, this.current);
  }

  cancelUpcoming(): void {
    if (!this.upcoming) return;
    this.confirmationService.confirm({
      header: '¿Cancelar el próximo presupuesto?',
      message: 'Se va a eliminar el plan que armaste para el mes que viene.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, cancelar',
      rejectLabel: 'Volver',
      accept: async () => {
        await lastValueFrom(this.budgetService.delete(this.upcoming!.id));
        this.messageService.add({ severity: 'success', summary: 'Presupuesto del próximo mes cancelado' });
      }
    });
  }

  deactivateCurrent(): void {
    if (!this.current) return;
    this.confirmationService.confirm({
      header: '¿Desactivar presupuesto?',
      message: 'Dejará de aplicarse este mes. Queda guardado en el historial y podés crear uno nuevo cuando quieras.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, desactivar',
      rejectLabel: 'Cancelar',
      accept: async () => {
        await lastValueFrom(this.budgetService.delete(this.current!.id));
        this.messageService.add({ severity: 'success', summary: 'Presupuesto desactivado' });
      }
    });
  }

  autoFillSelected(): void {
    const reference = new Date();
    for (const row of this.rows) {
      if (!row.included) continue;
      row.amount = this.budgetService.suggestMonthlyLimit(this.allTransactions, row.categoryId, this.suggestMethod, reference);
    }
    this.totalAmount = this.allocatedSum;
  }

  async saveBudget(): Promise<void> {
    if (this.totalAmount === null || this.totalAmount <= 0) {
      this.messageService.add({ severity: 'warn', summary: 'Ingresá un monto total válido' });
      return;
    }

    const included = this.rows.filter((row) => row.included);
    if (included.some((row) => row.amount === null || row.amount < 0)) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Montos incompletos',
        detail: 'Completá un monto válido para cada categoría seleccionada'
      });
      return;
    }

    const includedGoals = this.goalRows.filter((row) => row.included);
    if (includedGoals.some((row) => row.amount === null || row.amount <= 0 || !row.accountId)) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Metas incompletas',
        detail: 'Completá cuenta de origen y un monto válido para cada meta seleccionada'
      });
      return;
    }

    if (this.allocatedSum > this.totalAmount) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Presupuesto sobreasignado',
        detail: 'La suma de las categorías y metas supera el monto total'
      });
      return;
    }

    const allocations: BudgetAllocation[] = included.map((row) => ({ categoryId: row.categoryId, amount: row.amount! }));
    const goalAllocations: BudgetGoalAllocation[] = includedGoals.map((row) => ({
      goalId: row.goalId,
      accountId: row.accountId!,
      amount: row.amount!
    }));

    await lastValueFrom(this.budgetService.save(this.targetMonth, this.totalAmount, allocations, goalAllocations));
    this.messageService.add({ severity: 'success', summary: 'Presupuesto guardado' });

    this.dialogVisible = false;
  }

  formatMonthLabel(date: Date): string {
    const label = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(date);
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  formatDate(date: Date): string {
    const base = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
    if (date.getHours() === 0 && date.getMinutes() === 0) return base;
    return `${base} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  private openFormDialog(targetMonth: Date, source: Budget | null): void {
    this.targetMonthOptions = this.buildTargetMonthOptions(targetMonth);
    this.targetMonth = this.targetMonthOptions.find((opt) => opt.value.getTime() === targetMonth.getTime())!.value;
    this.totalAmount = source?.totalAmount ?? null;
    this.minSpendFilter = 0;
    this.suggestMethod = 'avg3';
    this.rows = this.buildRows(source?.allocations ?? []);
    this.goalRows = this.buildGoalRows(source?.goalAllocations ?? []);
    this.dialogVisible = true;
  }

  private buildTargetMonthOptions(preferred: Date): { label: string; value: Date }[] {
    const current = this.currentMonthStart();
    const next = this.nextMonthStart();
    const options = [
      { label: `${this.formatMonthLabel(current)} (este mes)`, value: current },
      { label: `${this.formatMonthLabel(next)} (el mes que viene)`, value: next }
    ];

    if (!options.some((opt) => opt.value.getTime() === preferred.getTime())) {
      options.push({ label: this.formatMonthLabel(preferred), value: preferred });
    }

    return options;
  }

  private buildRows(existing: BudgetAllocation[]): BudgetFormRow[] {
    return this.expenseCategories
      .map((cat) => {
        const historicalTotal = this.allTransactions
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

  private buildGoalRows(existing: BudgetGoalAllocation[]): BudgetFormGoalRow[] {
    return this.goals.map((goal) => {
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

  private goalName(goalId: string): string {
    return this.goals.find((goal) => goal.id === goalId)?.name ?? 'Meta eliminada';
  }

  private accountName(accountId: string): string {
    return this.accounts.find((account) => account.id === accountId)?.name ?? 'Cuenta eliminada';
  }

  rolloverSummary(item: PendingGoalRollover): string {
    return `${this.formatMonthLabel(item.budget.month)}: ${item.allocation.amount.toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })} planeados para "${this.goalName(item.allocation.goalId)}" desde "${this.accountName(item.allocation.accountId)}"`;
  }

  get rolloverDestinationOptions(): Account[] {
    return this.accounts.filter((account) => account.id !== this.rolloverForm.sourceAccountId);
  }

  openRolloverDialog(item: PendingGoalRollover): void {
    this.resolvingRollover = item;
    const originalStillExists = this.accounts.some((account) => account.id === item.allocation.accountId);
    this.rolloverForm = {
      action: 'saved',
      sourceAccountId: originalStillExists ? item.allocation.accountId : null,
      destinationAccountId: null
    };
    this.rolloverDialogVisible = true;
  }

  async saveRolloverResolution(): Promise<void> {
    if (!this.resolvingRollover) return;
    const { action, sourceAccountId, destinationAccountId } = this.rolloverForm;
    const { budget, allocation } = this.resolvingRollover;

    if (action !== 'kept' && !sourceAccountId) {
      this.messageService.add({ severity: 'warn', summary: 'Elegí de qué cuenta sale el dinero' });
      return;
    }
    if (action === 'transferred' && (!destinationAccountId || destinationAccountId === sourceAccountId)) {
      this.messageService.add({ severity: 'warn', summary: 'Elegí una cuenta de destino distinta' });
      return;
    }

    const description = `Rollover presupuesto ${this.formatMonthLabel(budget.month)} — ${this.goalName(allocation.goalId)}`;

    if (action === 'transferred') {
      await lastValueFrom(
        this.accountService.transfer(sourceAccountId!, destinationAccountId!, allocation.amount, new Date(), description)
      );
    } else if (action === 'saved') {
      this.accountService.adjustBalance(sourceAccountId!, -allocation.amount);
      await lastValueFrom(this.goalService.contribute(allocation.goalId, allocation.amount, new Date(), description));
    }

    await lastValueFrom(
      this.budgetService.markGoalAllocationResolved(
        budget.id,
        allocation.goalId,
        action,
        action === 'kept' ? allocation.accountId : sourceAccountId!,
        action === 'transferred' ? destinationAccountId! : undefined
      )
    );

    this.messageService.add({ severity: 'success', summary: 'Rollover resuelto' });
    this.rolloverDialogVisible = false;
    this.resolvingRollover = null;
  }
}
