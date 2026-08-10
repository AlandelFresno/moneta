import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil, combineLatest, debounceTime, distinctUntilChanged } from 'rxjs';
import { lastValueFrom } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { ConfirmationService, MessageService } from 'primeng/api';

import { Transaction, TransactionType } from '../../core/types/transaction.types';
import { Category, CategoryType } from '../../core/types/category.types';
import { Bill } from '../../core/types/bill.types';
import { TransactionService } from '../../services/transaction.service';
import { CategoryService } from '../../services/category.service';
import { CsvService, ParsedCsvRow } from '../../services/csv.service';
import { BillService, BillDueStatus } from '../../services/bill.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { TransactionWithCategory, withCategory } from '../../core/utils/transaction-display.util';
import { CATEGORY_ICON_OPTIONS } from '../../core/utils/category-icons.util';

interface TransactionGroup {
  key: string;
  label: string;
  transactions: TransactionWithCategory[];
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

interface CategoryQuickForm {
  name: string;
  color: string;
  icon: string;
}

const EMPTY_CATEGORY_FORM: CategoryQuickForm = {
  name: '',
  color: '#3b82f6',
  icon: 'tag'
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
    InputGroupModule,
    InputGroupAddonModule,
    SelectModule,
    DatePickerModule,
    IconComponent
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

  categoryDialogVisible = false;
  categoryForm: CategoryQuickForm = { ...EMPTY_CATEGORY_FORM };
  readonly categoryIconOptions = CATEGORY_ICON_OPTIONS;

  bills: Bill[] = [];
  dueBills: BillDueStatus[] = [];
  payDialogVisible = false;
  payingBill: BillDueStatus | null = null;
  payAmount: number | null = null;

  constructor(
    private readonly transactionService: TransactionService,
    private readonly categoryService: CategoryService,
    private readonly csvService: CsvService,
    private readonly billService: BillService,
    private readonly confirmationService: ConfirmationService,
    private readonly messageService: MessageService,
    private readonly route: ActivatedRoute,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    combineLatest([this.transactionService.getAll(), this.categoryService.getAll()])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([transactions, categories]) => {
        this.categories = categories;
        this.transactions = transactions
          .map((txn) => withCategory(txn, categories))
          .sort((a, b) => b.date.getTime() - a.date.getTime());
        this.applyFilters();
        this.cdr.markForCheck();
      });

    const queryType = this.route.snapshot.queryParamMap.get('type');
    if (queryType === 'income' || queryType === 'expense') {
      this.openCreateDialog(queryType);
    }

    this.billService
      .getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe((bills) => {
        this.bills = bills;
        this.dueBills = this.billService.dueStatuses(bills, new Date());
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

  get groupedTransactions(): TransactionGroup[] {
    const groups = new Map<string, TransactionGroup>();

    for (const txn of this.filteredTransactions) {
      const key = `${txn.date.getFullYear()}-${txn.date.getMonth()}`;
      let group = groups.get(key);
      if (!group) {
        group = { key, label: this.monthYearLabel(txn.date), transactions: [] };
        groups.set(key, group);
      }
      group.transactions.push(txn);
    }

    return Array.from(groups.values());
  }

  private monthYearLabel(date: Date): string {
    const label = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(date);
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  exportToCsv(): void {
    this.csvService.exportToCsv(this.filteredTransactions, this.categories, this.bills);
  }

  async onCsvFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    let lines: string[];
    try {
      lines = await this.csvService.readCsvSections(file);
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error al leer el CSV',
        detail: error instanceof Error ? error.message : 'Formato inválido'
      });
      return;
    }

    const newCategories = this.csvService.parseNewCategories(lines, this.categories);
    const createdCategories: Category[] = [];

    for (const category of newCategories) {
      createdCategories.push(await lastValueFrom(this.categoryService.create(category)));
    }

    const categoriesForMatching = [...this.categories, ...createdCategories];

    const billResult = this.csvService.parseNewBills(lines, categoriesForMatching, this.bills);
    let createdBillsCount = 0;
    for (const bill of billResult.bills) {
      await lastValueFrom(this.billService.create(bill));
      createdBillsCount++;
    }

    let result;
    try {
      result = this.csvService.parseTransactions(lines, categoriesForMatching, this.transactions);
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error al leer el CSV',
        detail: error instanceof Error ? error.message : 'Formato inválido'
      });
      return;
    }

    if (result.rows.length === 0) {
      if (createdBillsCount > 0 || createdCategories.length > 0) {
        await this.importRows([], result.skippedUnknownCategory, createdCategories.length, createdBillsCount, billResult.skippedUnknownCategory);
        return;
      }

      this.messageService.add({
        severity: 'warn',
        summary: 'Nada para importar',
        detail:
          result.skippedUnknownCategory > 0
            ? `${result.skippedUnknownCategory} filas omitidas por categoría desconocida`
            : 'El archivo no tiene filas válidas'
      });
      return;
    }

    const duplicates = result.rows.filter((row) => row.isDuplicate);
    const unique = result.rows.filter((row) => !row.isDuplicate);

    if (duplicates.length === 0) {
      await this.importRows(unique, result.skippedUnknownCategory, createdCategories.length, createdBillsCount, billResult.skippedUnknownCategory);
      return;
    }

    this.confirmationService.confirm({
      header: 'Se encontraron duplicados',
      message: `${duplicates.length} de ${result.rows.length} filas parecen ya existir (misma fecha, nombre y monto). ¿Importar solo las ${unique.length} filas nuevas, o importar todo igual?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Solo nuevas',
      rejectLabel: 'Importar todo',
      accept: async () => {
        await this.importRows(unique, result.skippedUnknownCategory, createdCategories.length, createdBillsCount, billResult.skippedUnknownCategory);
      },
      reject: async () => {
        await this.importRows(result.rows, result.skippedUnknownCategory, createdCategories.length, createdBillsCount, billResult.skippedUnknownCategory);
      }
    });
  }

  private async importRows(
    rows: ParsedCsvRow[],
    skippedUnknownCategory: number,
    createdCategoriesCount: number,
    createdBillsCount: number,
    skippedBillsUnknownCategory: number
  ): Promise<void> {
    for (const row of rows) {
      await lastValueFrom(this.transactionService.create(row.transaction));
    }

    const detailParts: string[] = [];
    if (rows.length > 0) {
      detailParts.push(`${rows.length} transacciones importadas`);
    }
    if (createdCategoriesCount > 0) {
      detailParts.push(`${createdCategoriesCount} categorías nuevas creadas`);
    }
    if (createdBillsCount > 0) {
      detailParts.push(`${createdBillsCount} servicios nuevos creados`);
    }
    if (skippedUnknownCategory > 0) {
      detailParts.push(`${skippedUnknownCategory} transacciones omitidas por categoría desconocida`);
    }
    if (skippedBillsUnknownCategory > 0) {
      detailParts.push(`${skippedBillsUnknownCategory} servicios omitidos por categoría desconocida`);
    }

    this.messageService.add({
      severity: 'success',
      summary: 'Importación completada',
      detail: detailParts.join(', ')
    });
  }

  openCreateDialog(type: TransactionType = 'expense'): void {
    this.form = { ...EMPTY_FORM, type, date: new Date() };
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

  openCreateCategoryDialog(): void {
    this.categoryForm = { ...EMPTY_CATEGORY_FORM };
    this.categoryDialogVisible = true;
  }

  async saveQuickCategory(): Promise<void> {
    if (!this.categoryForm.name.trim()) {
      this.messageService.add({ severity: 'warn', summary: 'Falta el nombre', detail: 'Ingresá un nombre para la categoría' });
      return;
    }

    const type: CategoryType = this.form.type;
    const created = await lastValueFrom(
      this.categoryService.create({
        name: this.categoryForm.name.trim(),
        type,
        color: this.categoryForm.color,
        icon: this.categoryForm.icon
      })
    );

    this.form.categoryId = created.id;
    this.categoryDialogVisible = false;
    this.messageService.add({ severity: 'success', summary: 'Categoría creada' });
  }

  get categoryFilterOptions(): { label: string; value: string }[] {
    return [{ label: 'Todas las categorías', value: 'all' }, ...this.categories.map((cat) => ({ label: cat.name, value: cat.id }))];
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

  openPayBillDialog(status: BillDueStatus): void {
    this.payingBill = status;
    this.payAmount = status.bill.approxAmount;
    this.payDialogVisible = true;
  }

  async confirmBillPayment(): Promise<void> {
    if (!this.payingBill || this.payAmount === null || this.payAmount <= 0) {
      this.messageService.add({ severity: 'warn', summary: 'Ingresá un monto válido' });
      return;
    }

    const bill = this.payingBill.bill;
    const paidDate = new Date();

    const transaction = await lastValueFrom(
      this.transactionService.create({
        categoryId: bill.categoryId,
        type: 'expense',
        name: bill.name,
        description: bill.description || `Pago de servicio: ${bill.name}`,
        amount: this.payAmount,
        date: paidDate
      })
    );

    await lastValueFrom(this.billService.recordPayment(bill.id, this.payAmount, transaction.id, paidDate));

    this.messageService.add({ severity: 'success', summary: 'Pago registrado', detail: 'Se creó la transacción correspondiente' });
    this.payDialogVisible = false;
    this.payingBill = null;
  }
}
