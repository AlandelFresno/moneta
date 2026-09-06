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
import { ConfirmationService, MessageService } from 'primeng/api';

import { Account, AccountType, AccountTransfer } from '../../core/types/account.types';
import { Category } from '../../core/types/category.types';
import { AccountService } from '../../services/account.service';
import { TransactionService } from '../../services/transaction.service';
import { CategoryService } from '../../services/category.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { CATEGORY_ICON_OPTIONS } from '../../core/utils/category-icons.util';

interface AccountForm {
  id: string | null;
  name: string;
  type: AccountType;
  balance: number | null;
  color: string;
  icon: string;
}

const EMPTY_FORM: AccountForm = {
  id: null,
  name: '',
  type: 'cash',
  balance: 0,
  color: '#3b82f6',
  icon: 'wallet'
};

interface TransferForm {
  fromAccountId: string;
  toAccountId: string;
  amount: number | null;
  date: Date;
  description: string;
}

const EMPTY_TRANSFER_FORM: TransferForm = {
  fromAccountId: '',
  toAccountId: '',
  amount: null,
  date: new Date(),
  description: ''
};

interface TransferDisplay extends AccountTransfer {
  fromName: string;
  toName: string;
}

interface ReconcileForm {
  statementBalance: number | null;
  categoryId: string | null;
}

const EMPTY_RECONCILE_FORM: ReconcileForm = {
  statementBalance: null,
  categoryId: null
};

@Component({
  selector: 'app-accounts',
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
    IconComponent
  ],
  templateUrl: './accounts.page.html',
  styleUrl: './accounts.page.scss'
})
export class AccountsPage implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  accounts: Account[] = [];
  recentTransfers: TransferDisplay[] = [];
  categories: Category[] = [];
  readonly iconOptions = CATEGORY_ICON_OPTIONS;

  readonly typeOptions: { label: string; value: AccountType }[] = [
    { label: 'Efectivo', value: 'cash' },
    { label: 'Banco', value: 'bank' },
    { label: 'Tarjeta de crédito', value: 'credit' },
    { label: 'Ahorros', value: 'savings' },
    { label: 'Inversión', value: 'investment' }
  ];

  dialogVisible = false;
  form: AccountForm = { ...EMPTY_FORM };

  transferDialogVisible = false;
  transferForm: TransferForm = { ...EMPTY_TRANSFER_FORM };

  reconcileDialogVisible = false;
  reconcilingAccount: Account | null = null;
  reconcileForm: ReconcileForm = { ...EMPTY_RECONCILE_FORM };

  constructor(
    private readonly accountService: AccountService,
    private readonly transactionService: TransactionService,
    private readonly categoryService: CategoryService,
    private readonly confirmationService: ConfirmationService,
    private readonly messageService: MessageService
  ) {}

  ngOnInit(): void {
    combineLatest([this.accountService.getAll(), this.accountService.getTransfers()])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([accounts, transfers]) => {
        this.accounts = [...accounts].sort((a, b) => a.name.localeCompare(b.name));
        this.recentTransfers = [...transfers]
          .sort((a, b) => b.date.getTime() - a.date.getTime())
          .slice(0, 10)
          .map((transfer) => ({
            ...transfer,
            fromName: this.accountName(transfer.fromAccountId, accounts),
            toName: this.accountName(transfer.toAccountId, accounts)
          }));

        if (this.reconcilingAccount) {
          this.reconcilingAccount = accounts.find((a) => a.id === this.reconcilingAccount!.id) ?? null;
        }
      });

    this.categoryService
      .getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe((categories) => {
        this.categories = categories;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get transferDestinationOptions(): Account[] {
    return this.accounts.filter((account) => account.id !== this.transferForm.fromAccountId);
  }

  private accountName(id: string, accounts: Account[]): string {
    return accounts.find((account) => account.id === id)?.name ?? 'Cuenta eliminada';
  }

  typeLabel(type: AccountType): string {
    return this.typeOptions.find((opt) => opt.value === type)?.label ?? type;
  }

  openCreateDialog(): void {
    this.form = { ...EMPTY_FORM };
    this.dialogVisible = true;
  }

  openEditDialog(account: Account): void {
    this.form = {
      id: account.id,
      name: account.name,
      type: account.type,
      balance: account.balance,
      color: account.color,
      icon: account.icon
    };
    this.dialogVisible = true;
  }

  async saveAccount(): Promise<void> {
    if (!this.form.name.trim()) {
      this.messageService.add({ severity: 'warn', summary: 'Falta el nombre', detail: 'Ingresá un nombre para la cuenta' });
      return;
    }

    if (this.form.id) {
      await lastValueFrom(
        this.accountService.update(this.form.id, {
          name: this.form.name.trim(),
          type: this.form.type,
          color: this.form.color,
          icon: this.form.icon
        })
      );
      this.messageService.add({ severity: 'success', summary: 'Cuenta actualizada' });
    } else {
      await lastValueFrom(
        this.accountService.create({
          name: this.form.name.trim(),
          type: this.form.type,
          balance: this.form.balance ?? 0,
          color: this.form.color,
          icon: this.form.icon
        })
      );
      this.messageService.add({ severity: 'success', summary: 'Cuenta creada' });
    }

    this.dialogVisible = false;
  }

  deleteAccount(account: Account): void {
    this.confirmationService.confirm({
      header: '¿Eliminar cuenta?',
      message: `Se eliminará "${account.name}". Las transacciones existentes no se modifican.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí',
      rejectLabel: 'No',
      accept: async () => {
        await lastValueFrom(this.accountService.delete(account.id));
        this.messageService.add({ severity: 'success', summary: 'Cuenta eliminada' });
      }
    });
  }

  openTransferDialog(): void {
    this.transferForm = {
      ...EMPTY_TRANSFER_FORM,
      fromAccountId: this.accounts[0]?.id ?? '',
      toAccountId: this.accounts[1]?.id ?? '',
      date: new Date()
    };
    this.transferDialogVisible = true;
  }

  onTransferSourceChange(): void {
    if (this.transferForm.toAccountId === this.transferForm.fromAccountId) {
      this.transferForm.toAccountId = this.transferDestinationOptions[0]?.id ?? '';
    }
  }

  async saveTransfer(): Promise<void> {
    const { fromAccountId, toAccountId, amount, date, description } = this.transferForm;

    if (!fromAccountId || !toAccountId || fromAccountId === toAccountId) {
      this.messageService.add({ severity: 'warn', summary: 'Elegí dos cuentas distintas' });
      return;
    }
    if (amount === null || amount <= 0) {
      this.messageService.add({ severity: 'warn', summary: 'Ingresá un monto válido' });
      return;
    }

    await lastValueFrom(this.accountService.transfer(fromAccountId, toAccountId, amount, date, description));
    this.messageService.add({ severity: 'success', summary: 'Transferencia registrada' });
    this.transferDialogVisible = false;
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  }

  openReconcileDialog(account: Account): void {
    this.reconcilingAccount = account;
    this.reconcileForm = { statementBalance: account.balance, categoryId: null };
    this.reconcileDialogVisible = true;
  }

  get reconcileDiff(): number | null {
    if (!this.reconcilingAccount || this.reconcileForm.statementBalance === null) return null;
    return Math.round((this.reconcileForm.statementBalance - this.reconcilingAccount.balance) * 100) / 100;
  }

  get reconcileCategories(): Category[] {
    const diff = this.reconcileDiff;
    if (diff === null) return [];
    return this.categories.filter((cat) => cat.type === (diff > 0 ? 'income' : 'expense'));
  }

  async saveReconciliation(): Promise<void> {
    const account = this.reconcilingAccount;
    const diff = this.reconcileDiff;
    if (!account || diff === null) {
      this.messageService.add({ severity: 'warn', summary: 'Ingresá el saldo real' });
      return;
    }

    if (Math.abs(diff) >= 0.01 && !this.reconcileForm.categoryId) {
      this.messageService.add({ severity: 'warn', summary: 'Elegí una categoría para el ajuste' });
      return;
    }

    if (Math.abs(diff) >= 0.01) {
      await lastValueFrom(
        this.transactionService.create({
          categoryId: this.reconcileForm.categoryId!,
          accountId: account.id,
          type: diff > 0 ? 'income' : 'expense',
          name: 'Ajuste de conciliación',
          description: `Conciliación de ${account.name}`,
          amount: Math.abs(diff),
          date: new Date()
        })
      );
    }

    await lastValueFrom(
      this.accountService.update(account.id, {
        reconciledAt: new Date(),
        reconciledBalance: this.reconcileForm.statementBalance!
      })
    );

    this.messageService.add({ severity: 'success', summary: 'Cuenta conciliada' });
    this.reconcileDialogVisible = false;
    this.reconcilingAccount = null;
  }
}
