import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, combineLatest, debounceTime, distinctUntilChanged } from 'rxjs';
import { lastValueFrom } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { ConfirmationService, MessageService } from 'primeng/api';

import { Transaction, TransactionType } from '../../core/types/transaction.types';
import { Category } from '../../core/types/category.types';
import { TransactionService } from '../../services/transaction.service';
import { CategoryService } from '../../services/category.service';

interface TransactionWithCategory extends Transaction {
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
}

interface TransactionForm {
  id: string | null;
  categoryId: string;
  type: TransactionType;
  name: string;
  description: string;
  amount: number | null;
  date: Date;
}

const EMPTY_FORM: TransactionForm = {
  id: null,
  categoryId: '',
  type: 'expense',
  name: '',
  description: '',
  amount: null,
  date: new Date()
};

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    DatePickerModule
  ],
  templateUrl: './transactions.page.html',
  styleUrl: './transactions.page.scss'
})
export class TransactionsPage implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly searchInput$ = new Subject<string>();

  transactions: TransactionWithCategory[] = [];
  filteredTransactions: TransactionWithCategory[] = [];
  categories: Category[] = [];

  readonly typeOptions: { label: string; value: 'all' | TransactionType }[] = [
    { label: 'Todas', value: 'all' },
    { label: 'Ingresos', value: 'income' },
    { label: 'Gastos', value: 'expense' }
  ];

  filters = {
    type: 'all' as 'all' | TransactionType,
    categoryId: 'all',
    searchText: ''
  };

  stats = {
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
    count: 0
  };

  dialogVisible = false;
  form: TransactionForm = { ...EMPTY_FORM };

  constructor(
    private readonly transactionService: TransactionService,
    private readonly categoryService: CategoryService,
    private readonly confirmationService: ConfirmationService,
    private readonly messageService: MessageService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    combineLatest([this.transactionService.getAll(), this.categoryService.getAll()])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([transactions, categories]) => {
        this.categories = categories;
        this.transactions = transactions
          .map((txn) => this.withCategory(txn, categories))
          .sort((a, b) => b.date.getTime() - a.date.getTime());
        this.applyFilters();
        this.cdr.markForCheck();
      });

    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((text) => {
        this.filters.searchText = text;
        this.applyFilters();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private withCategory(txn: Transaction, categories: Category[]): TransactionWithCategory {
    const category = categories.find((cat) => cat.id === txn.categoryId);
    return {
      ...txn,
      categoryName: category?.name ?? 'Sin categoría',
      categoryColor: category?.color ?? '#6b7280',
      categoryIcon: category?.icon ?? 'tag'
    };
  }

  onSearchInput(value: string): void {
    this.searchInput$.next(value);
  }

  applyFilters(): void {
    let filtered = [...this.transactions];

    if (this.filters.type !== 'all') {
      filtered = filtered.filter((txn) => txn.type === this.filters.type);
    }

    if (this.filters.categoryId !== 'all') {
      filtered = filtered.filter((txn) => txn.categoryId === this.filters.categoryId);
    }

    if (this.filters.searchText) {
      const search = this.filters.searchText.toLowerCase();
      filtered = filtered.filter(
        (txn) =>
          txn.name.toLowerCase().includes(search) ||
          txn.description.toLowerCase().includes(search) ||
          txn.categoryName.toLowerCase().includes(search)
      );
    }

    this.filteredTransactions = filtered;
    this.calculateStats();
  }

  private calculateStats(): void {
    this.stats.totalIncome = this.filteredTransactions
      .filter((txn) => txn.type === 'income')
      .reduce((sum, txn) => sum + txn.amount, 0);
    this.stats.totalExpense = this.filteredTransactions
      .filter((txn) => txn.type === 'expense')
      .reduce((sum, txn) => sum + txn.amount, 0);
    this.stats.balance = this.stats.totalIncome - this.stats.totalExpense;
    this.stats.count = this.filteredTransactions.length;
  }

  clearFilters(): void {
    this.filters = { type: 'all', categoryId: 'all', searchText: '' };
    this.applyFilters();
  }

  openCreateDialog(): void {
    this.form = { ...EMPTY_FORM, date: new Date() };
    this.dialogVisible = true;
  }

  openEditDialog(txn: Transaction): void {
    this.form = {
      id: txn.id,
      categoryId: txn.categoryId,
      type: txn.type,
      name: txn.name,
      description: txn.description,
      amount: txn.amount,
      date: txn.date
    };
    this.dialogVisible = true;
  }

  categoriesForType(type: TransactionType): Category[] {
    return this.categories.filter((cat) => cat.type === type);
  }

  async saveTransaction(): Promise<void> {
    if (!this.form.categoryId || !this.form.name || this.form.amount === null || this.form.amount <= 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Datos incompletos',
        detail: 'Completá categoría, nombre y un monto válido'
      });
      return;
    }

    const payload = {
      categoryId: this.form.categoryId,
      type: this.form.type,
      name: this.form.name,
      description: this.form.description,
      amount: this.form.amount,
      date: this.form.date
    };

    if (this.form.id) {
      await lastValueFrom(this.transactionService.update(this.form.id, payload));
      this.messageService.add({ severity: 'success', summary: 'Transacción actualizada' });
    } else {
      await lastValueFrom(this.transactionService.create(payload));
      this.messageService.add({ severity: 'success', summary: 'Transacción creada' });
    }

    this.dialogVisible = false;
  }

  deleteTransaction(txn: Transaction): void {
    this.confirmationService.confirm({
      header: '¿Eliminar transacción?',
      message: 'Esta acción no se puede deshacer.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí',
      rejectLabel: 'No',
      accept: async () => {
        await lastValueFrom(this.transactionService.delete(txn.id));
        this.messageService.add({ severity: 'success', summary: 'Transacción eliminada' });
      }
    });
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('es-AR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(date);
  }
}
