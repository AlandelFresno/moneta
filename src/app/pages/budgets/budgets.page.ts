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

import { Budget, BudgetAllocation, BudgetProgress, BudgetSuggestMethod } from '../../core/types/budget.types';
import { Category } from '../../core/types/category.types';
import { Transaction } from '../../core/types/transaction.types';
import { BudgetService } from '../../services/budget.service';
import { CategoryService } from '../../services/category.service';
import { TransactionService } from '../../services/transaction.service';
import { DashboardService } from '../../services/dashboard.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { BudgetProgressComponent } from '../../shared/budget-progress/budget-progress.component';

interface BudgetFormRow {
  categoryId: string;
  name: string;
  color: string;
  icon: string;
  historicalTotal: number;
  included: boolean;
  amount: number | null;
}

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
    BudgetProgressComponent
  ],
  templateUrl: './budgets.page.html',
  styleUrl: './budgets.page.scss'
})
export class BudgetsPage implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  categories: Category[] = [];
  expenseCategories: Category[] = [];
  allTransactions: Transaction[] = [];

  current: Budget | null = null;
  upcoming: Budget | null = null;
  progress: BudgetProgress | null = null;
  history: Budget[] = [];
  historyPanelOpen = false;

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

  constructor(
    private readonly budgetService: BudgetService,
    private readonly categoryService: CategoryService,
    private readonly transactionService: TransactionService,
    private readonly dashboardService: DashboardService,
    private readonly confirmationService: ConfirmationService,
    private readonly messageService: MessageService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    combineLatest([
      this.budgetService.getAll(),
      this.transactionService.getAll(),
      this.categoryService.getAll()
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([budgets, transactions, categories]) => {
        const reference = new Date();
        this.categories = categories;
        this.expenseCategories = categories.filter((cat) => cat.type === 'expense');
        this.allTransactions = transactions;
        this.current = this.budgetService.currentBudget(budgets, reference);
        this.upcoming = this.budgetService.upcomingBudget(budgets, reference);
        this.history = this.budgetService.historyBudgets(budgets, reference);

        if (this.current) {
          const range = this.dashboardService.rangeForPreset('thisMonth', reference, transactions, null);
          const thisMonth = this.dashboardService.transactionsInRange(transactions, range);
          this.progress = this.budgetService.budgetProgress(this.current, thisMonth);
        } else {
          this.progress = null;
        }

        this.cdr.markForCheck();
      });
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
    return this.rows.filter((row) => row.included).reduce((sum, row) => sum + (row.amount ?? 0), 0);
  }

  get remaining(): number {
    return (this.totalAmount ?? 0) - this.allocatedSum;
  }

  private currentMonthStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  private nextMonthStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
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

    if (this.allocatedSum > this.totalAmount) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Presupuesto sobreasignado',
        detail: 'La suma de las categorías supera el monto total'
      });
      return;
    }

    const allocations: BudgetAllocation[] = included.map((row) => ({ categoryId: row.categoryId, amount: row.amount! }));

    await lastValueFrom(this.budgetService.save(this.targetMonth, this.totalAmount, allocations));
    this.messageService.add({ severity: 'success', summary: 'Presupuesto guardado' });

    this.dialogVisible = false;
  }

  formatMonthLabel(date: Date): string {
    const label = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(date);
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  }

  private openFormDialog(targetMonth: Date, source: Budget | null): void {
    this.targetMonthOptions = this.buildTargetMonthOptions(targetMonth);
    this.targetMonth = this.targetMonthOptions.find((opt) => opt.value.getTime() === targetMonth.getTime())!.value;
    this.totalAmount = source?.totalAmount ?? null;
    this.minSpendFilter = 0;
    this.suggestMethod = 'avg3';
    this.rows = this.buildRows(source?.allocations ?? []);
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
}
