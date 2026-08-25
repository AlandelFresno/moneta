import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, combineLatest, lastValueFrom } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ConfirmationService, MessageService } from 'primeng/api';

import { Bill, BillPeriod } from '../../core/types/bill.types';
import { Category } from '../../core/types/category.types';
import { BillService, BillDueStatus } from '../../services/bill.service';
import { BillNotificationService } from '../../services/bill-notification.service';
import { CategoryService } from '../../services/category.service';
import { TransactionService } from '../../services/transaction.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { detectRecurringCandidates, RecurringCandidate } from '../../core/utils/recurring-detection.util';

interface BillWithCategory extends Bill {
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
}

interface RecurringSuggestion extends RecurringCandidate {
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  signature: string;
}

const DISMISSED_SUGGESTIONS_KEY = 'dismissedRecurringSuggestions';

type TerminationMode = 'ongoing' | 'endDate' | 'installments';

interface BillForm {
  id: string | null;
  name: string;
  description: string;
  categoryId: string;
  approxAmount: number | null;
  period: BillPeriod;
  dueDate: Date;
  terminationMode: TerminationMode;
  endDate: Date | null;
  totalInstallments: number | null;
  active: boolean;
}

const EMPTY_FORM: BillForm = {
  id: null,
  name: '',
  description: '',
  categoryId: '',
  approxAmount: null,
  period: 'monthly',
  dueDate: new Date(),
  terminationMode: 'ongoing',
  endDate: null,
  totalInstallments: null,
  active: true
};

@Component({
  selector: 'app-bills',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    DatePickerModule,
    ToggleSwitchModule,
    IconComponent
  ],
  templateUrl: './bills.page.html',
  styleUrl: './bills.page.scss'
})
export class BillsPage implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  bills: BillWithCategory[] = [];
  categories: Category[] = [];
  dueStatuses: BillDueStatus[] = [];
  suggestions: RecurringSuggestion[] = [];
  private dismissedSuggestions: Set<string> = this.loadDismissedSuggestions();

  readonly periodOptions: { label: string; value: BillPeriod }[] = [
    { label: 'Semanal', value: 'weekly' },
    { label: 'Mensual', value: 'monthly' },
    { label: 'Anual', value: 'yearly' }
  ];

  readonly terminationModeOptions: { label: string; value: TerminationMode }[] = [
    { label: 'Sin fin', value: 'ongoing' },
    { label: 'Hasta una fecha', value: 'endDate' },
    { label: 'Cantidad de cuotas', value: 'installments' }
  ];

  dialogVisible = false;
  form: BillForm = { ...EMPTY_FORM };

  payDialogVisible = false;
  payingBill: BillWithCategory | null = null;
  payAmount: number | null = null;

  reminderEnabled = false;
  reminderDaysBefore = 1;
  readonly reminderDaysOptions: { label: string; value: number }[] = [
    { label: 'El mismo día', value: 0 },
    { label: '1 día antes', value: 1 },
    { label: '3 días antes', value: 3 },
    { label: '7 días antes', value: 7 }
  ];

  constructor(
    private readonly billService: BillService,
    private readonly categoryService: CategoryService,
    private readonly transactionService: TransactionService,
    private readonly confirmationService: ConfirmationService,
    private readonly messageService: MessageService,
    readonly billNotificationService: BillNotificationService
  ) {}

  ngOnInit(): void {
    const reminderSettings = this.billNotificationService.settings();
    this.reminderEnabled = reminderSettings.enabled;
    this.reminderDaysBefore = reminderSettings.daysBefore;

    combineLatest([this.billService.getAll(), this.categoryService.getAll(), this.transactionService.getAll()])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([bills, categories, transactions]) => {
        this.categories = categories;
        this.bills = bills
          .map((bill) => this.withCategory(bill, categories))
          .sort((a, b) => a.name.localeCompare(b.name));
        this.dueStatuses = this.billService.dueStatuses(bills, new Date());

        this.suggestions = detectRecurringCandidates(transactions, bills, new Date())
          .map((candidate) => this.withSuggestionDisplay(candidate, categories))
          .filter((suggestion) => !this.dismissedSuggestions.has(suggestion.signature));
      });
  }

  async onReminderToggle(): Promise<void> {
    const ok = await this.billNotificationService.setEnabled(this.reminderEnabled);
    if (!ok) {
      this.reminderEnabled = false;
      this.messageService.add({
        severity: 'warn',
        summary: 'Permiso denegado',
        detail: 'Activá las notificaciones para Moneta en los ajustes del sistema para recibir recordatorios.'
      });
    }
  }

  async onReminderDaysChange(): Promise<void> {
    await this.billNotificationService.setDaysBefore(this.reminderDaysBefore);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private withCategory(bill: Bill, categories: Category[]): BillWithCategory {
    const category = categories.find((cat) => cat.id === bill.categoryId);
    return {
      ...bill,
      categoryName: category?.name ?? 'Sin categoría',
      categoryColor: category?.color ?? '#6b7280',
      categoryIcon: category?.icon ?? 'tag'
    };
  }

  private withSuggestionDisplay(candidate: RecurringCandidate, categories: Category[]): RecurringSuggestion {
    const category = categories.find((cat) => cat.id === candidate.categoryId);
    return {
      ...candidate,
      categoryName: category?.name ?? 'Sin categoría',
      categoryColor: category?.color ?? '#6b7280',
      categoryIcon: category?.icon ?? 'tag',
      signature: `${candidate.categoryId}::${candidate.name.trim().toLowerCase()}`
    };
  }

  private loadDismissedSuggestions(): Set<string> {
    const raw = localStorage.getItem(DISMISSED_SUGGESTIONS_KEY);
    if (!raw) return new Set();
    const signatures: string[] = JSON.parse(raw);
    return new Set(signatures);
  }

  private persistDismissedSuggestions(): void {
    localStorage.setItem(DISMISSED_SUGGESTIONS_KEY, JSON.stringify([...this.dismissedSuggestions]));
  }

  dismissSuggestion(suggestion: RecurringSuggestion): void {
    this.dismissedSuggestions.add(suggestion.signature);
    this.persistDismissedSuggestions();
    this.suggestions = this.suggestions.filter((s) => s.signature !== suggestion.signature);
  }

  createFromSuggestion(suggestion: RecurringSuggestion): void {
    this.openCreateDialog({
      name: suggestion.name,
      categoryId: suggestion.categoryId,
      approxAmount: suggestion.avgAmount,
      period: 'monthly',
      dueDate: suggestion.lastDate
    });
  }

  openCreateDialog(prefill?: Partial<BillForm>): void {
    this.form = { ...EMPTY_FORM, dueDate: new Date(), categoryId: this.categories[0]?.id ?? '', ...prefill };
    this.dialogVisible = true;
  }

  openEditDialog(bill: Bill): void {
    const terminationMode: TerminationMode =
      bill.totalInstallments !== undefined ? 'installments' : bill.endDate !== undefined ? 'endDate' : 'ongoing';

    this.form = {
      id: bill.id,
      name: bill.name,
      description: bill.description,
      categoryId: bill.categoryId,
      approxAmount: bill.approxAmount,
      period: bill.period,
      dueDate: bill.dueDate,
      terminationMode,
      endDate: bill.endDate ?? null,
      totalInstallments: bill.totalInstallments ?? null,
      active: bill.active
    };
    this.dialogVisible = true;
  }

  async saveBill(): Promise<void> {
    if (!this.form.name.trim() || !this.form.categoryId || this.form.approxAmount === null || this.form.approxAmount <= 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Datos incompletos',
        detail: 'Completá nombre, categoría y un monto aproximado válido'
      });
      return;
    }

    if (this.form.terminationMode === 'endDate' && !this.form.endDate) {
      this.messageService.add({ severity: 'warn', summary: 'Elegí una fecha de fin' });
      return;
    }
    if (this.form.terminationMode === 'installments' && (this.form.totalInstallments === null || this.form.totalInstallments < 1)) {
      this.messageService.add({ severity: 'warn', summary: 'Ingresá una cantidad de cuotas válida' });
      return;
    }

    const payload = {
      name: this.form.name.trim(),
      description: this.form.description,
      categoryId: this.form.categoryId,
      approxAmount: this.form.approxAmount,
      period: this.form.period,
      dueDate: this.form.dueDate,
      endDate: this.form.terminationMode === 'endDate' ? this.form.endDate! : undefined,
      totalInstallments: this.form.terminationMode === 'installments' ? this.form.totalInstallments! : undefined,
      active: this.form.active
    };

    if (this.form.id) {
      await lastValueFrom(this.billService.update(this.form.id, payload));
      this.messageService.add({ severity: 'success', summary: 'Servicio actualizado' });
    } else {
      await lastValueFrom(this.billService.create(payload));
      this.messageService.add({ severity: 'success', summary: 'Servicio creado' });
    }

    this.dialogVisible = false;
  }

  deleteBill(bill: Bill): void {
    this.confirmationService.confirm({
      header: '¿Eliminar servicio?',
      message: `Se eliminará "${bill.name}" y su historial de pagos. Las transacciones ya creadas no se modifican.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí',
      rejectLabel: 'No',
      accept: async () => {
        await lastValueFrom(this.billService.delete(bill.id));
        this.messageService.add({ severity: 'success', summary: 'Servicio eliminado' });
      }
    });
  }

  openPayDialog(bill: BillWithCategory): void {
    this.payingBill = bill;
    this.payAmount = bill.approxAmount;
    this.payDialogVisible = true;
  }

  async confirmPayment(): Promise<void> {
    if (!this.payingBill || this.payAmount === null || this.payAmount <= 0) {
      this.messageService.add({ severity: 'warn', summary: 'Ingresá un monto válido' });
      return;
    }

    const paidDate = new Date();
    const transaction = await lastValueFrom(
      this.transactionService.create({
        categoryId: this.payingBill.categoryId,
        type: 'expense',
        name: this.payingBill.name,
        description: this.payingBill.description || `Pago de servicio: ${this.payingBill.name}`,
        amount: this.payAmount,
        date: paidDate
      })
    );

    await lastValueFrom(this.billService.recordPayment(this.payingBill.id, this.payAmount, transaction.id, paidDate));

    this.messageService.add({ severity: 'success', summary: 'Pago registrado', detail: 'Se creó la transacción correspondiente' });
    this.payDialogVisible = false;
    this.payingBill = null;
  }

  isDue(bill: Bill): boolean {
    return this.dueStatuses.some((status) => status.bill.id === bill.id);
  }

  isFinished(bill: Bill): boolean {
    return this.billService.isFinished(bill, new Date());
  }

  /** "2/3 cuotas" for installment bills, "Hasta 5 dic 2026" for end-dated ones, null otherwise. */
  terminationLabel(bill: Bill): string | null {
    if (bill.totalInstallments !== undefined) {
      return `${bill.payments.length}/${bill.totalInstallments} cuotas`;
    }
    if (bill.endDate !== undefined) {
      return `Hasta ${this.formatDate(bill.endDate)}`;
    }
    return null;
  }

  nextInstallmentNumber(bill: Bill): number {
    return bill.payments.length + 1;
  }

  periodLabel(period: BillPeriod): string {
    return this.periodOptions.find((opt) => opt.value === period)?.label ?? period;
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  }
}
