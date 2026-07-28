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
import { CategoryService } from '../../services/category.service';
import { TransactionService } from '../../services/transaction.service';
import { IconComponent } from '../../shared/icon/icon.component';

interface BillWithCategory extends Bill {
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
}

interface BillForm {
  id: string | null;
  name: string;
  description: string;
  categoryId: string;
  approxAmount: number | null;
  period: BillPeriod;
  dueDate: Date;
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

  readonly periodOptions: { label: string; value: BillPeriod }[] = [
    { label: 'Semanal', value: 'weekly' },
    { label: 'Mensual', value: 'monthly' },
    { label: 'Anual', value: 'yearly' }
  ];

  dialogVisible = false;
  form: BillForm = { ...EMPTY_FORM };

  payDialogVisible = false;
  payingBill: BillWithCategory | null = null;
  payAmount: number | null = null;

  constructor(
    private readonly billService: BillService,
    private readonly categoryService: CategoryService,
    private readonly transactionService: TransactionService,
    private readonly confirmationService: ConfirmationService,
    private readonly messageService: MessageService
  ) {}

  ngOnInit(): void {
    combineLatest([this.billService.getAll(), this.categoryService.getAll()])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([bills, categories]) => {
        this.categories = categories;
        this.bills = bills
          .map((bill) => this.withCategory(bill, categories))
          .sort((a, b) => a.name.localeCompare(b.name));
        this.dueStatuses = this.billService.dueStatuses(bills, new Date());
      });
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

  openCreateDialog(): void {
    this.form = { ...EMPTY_FORM, dueDate: new Date(), categoryId: this.categories[0]?.id ?? '' };
    this.dialogVisible = true;
  }

  openEditDialog(bill: Bill): void {
    this.form = {
      id: bill.id,
      name: bill.name,
      description: bill.description,
      categoryId: bill.categoryId,
      approxAmount: bill.approxAmount,
      period: bill.period,
      dueDate: bill.dueDate,
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

    const payload = {
      name: this.form.name.trim(),
      description: this.form.description,
      categoryId: this.form.categoryId,
      approxAmount: this.form.approxAmount,
      period: this.form.period,
      dueDate: this.form.dueDate,
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

  periodLabel(period: BillPeriod): string {
    return this.periodOptions.find((opt) => opt.value === period)?.label ?? period;
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  }
}
