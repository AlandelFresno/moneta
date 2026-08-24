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
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ConfirmationService, MessageService } from 'primeng/api';

import { Transaction, TransactionType } from '../../core/types/transaction.types';
import { Category, CategoryType } from '../../core/types/category.types';
import { Bill } from '../../core/types/bill.types';
import { Account } from '../../core/types/account.types';
import { TransactionService } from '../../services/transaction.service';
import { TransactionCalculationService } from '../../services/transaction-calculation.service';
import { CategoryService } from '../../services/category.service';
import { CsvService, ParsedCsvRow } from '../../services/csv.service';
import { BillService, BillDueStatus } from '../../services/bill.service';
import { AccountService } from '../../services/account.service';
import { BudgetService } from '../../services/budget.service';
import { DashboardService } from '../../services/dashboard.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { BudgetProgressComponent } from '../../shared/budget-progress/budget-progress.component';
import { TransactionWithCategory, withCategory } from '../../core/utils/transaction-display.util';
import { CATEGORY_ICON_OPTIONS } from '../../core/utils/category-icons.util';
import { evaluateMathExpression } from '../../core/utils/math-expression.util';
import { Budget, BudgetProgress } from '../../core/types/budget.types';

interface TransactionListItem {
  key: string;
  isSplit: boolean;
  primary: TransactionWithCategory;
  lines: TransactionWithCategory[];
  totalAmount: number;
}

interface TransactionGroup {
  key: string;
  label: string;
  items: TransactionListItem[];
}

interface SplitLine {
  categoryId: string;
  amount: number | null;
}

interface TransactionForm {
  id: string | null;
  categoryId: string;
  accountId: string | null;
  type: TransactionType;
  name: string;
  description: string;
  amount: number | null;
  date: Date;
  isSplit: boolean;
  splitGroupId: string | null;
  splitLines: SplitLine[];
  calculatorExpression: string | null;
}

const EMPTY_FORM: TransactionForm = {
  id: null,
  categoryId: '',
  accountId: null,
  type: 'expense',
  name: '',
  description: '',
  amount: null,
  date: new Date(),
  isSplit: false,
  splitGroupId: null,
  splitLines: [],
  calculatorExpression: null
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
    ToggleSwitchModule,
    IconComponent,
    BudgetProgressComponent
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

  activeBudget: Budget | null = null;
  budgetProgress: BudgetProgress | null = null;

  accounts: Account[] = [];

  selectedIds = new Set<string>();
  bulkRecategorizeDialogVisible = false;
  bulkRecategorizeCategoryId: string | null = null;

  expandedSplitGroups = new Set<string>();

  calculatorOpen = false;
  calculatorInput = '';
  calculatorPreview: number | null = null;
  calculatorError: string | null = null;

  constructor(
    private readonly transactionService: TransactionService,
    private readonly transactionCalculationService: TransactionCalculationService,
    private readonly categoryService: CategoryService,
    private readonly csvService: CsvService,
    private readonly billService: BillService,
    private readonly budgetService: BudgetService,
    private readonly accountService: AccountService,
    private readonly dashboardService: DashboardService,
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

    this.accountService
      .getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe((accounts) => {
        this.accounts = accounts;
        this.cdr.markForCheck();
      });

    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((text) => {
        this.filters.searchText = text;
        this.applyFilters();
        this.cdr.markForCheck();
      });

    combineLatest([this.budgetService.getCurrent(), this.transactionService.getAll()])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([budget, transactions]) => {
        this.activeBudget = budget;
        if (budget) {
          const range = this.dashboardService.rangeForPreset('thisMonth', new Date(), transactions, null);
          const thisMonth = this.dashboardService.transactionsInRange(transactions, range);
          this.budgetProgress = this.budgetService.budgetProgress(budget, thisMonth);
        } else {
          this.budgetProgress = null;
        }
        this.cdr.markForCheck();
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

    const visibleIds = new Set(this.filteredTransactions.map((txn) => txn.id));
    for (const id of this.selectedIds) {
      if (!visibleIds.has(id)) this.selectedIds.delete(id);
    }
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

  /** Collapses sibling split-transaction lines into one composite item; full line data is read from `this.transactions` (unfiltered) so a partial filter match still shows every line. */
  get groupedTransactions(): TransactionGroup[] {
    const groups = new Map<string, TransactionGroup>();
    const seenSplitGroups = new Set<string>();

    for (const txn of this.filteredTransactions) {
      if (txn.splitGroupId && seenSplitGroups.has(txn.splitGroupId)) continue;

      const key = `${txn.date.getFullYear()}-${txn.date.getMonth()}`;
      let group = groups.get(key);
      if (!group) {
        group = { key, label: this.monthYearLabel(txn.date), items: [] };
        groups.set(key, group);
      }

      if (txn.splitGroupId) {
        seenSplitGroups.add(txn.splitGroupId);
        const lines = this.transactions.filter((t) => t.splitGroupId === txn.splitGroupId);
        group.items.push({
          key: txn.splitGroupId,
          isSplit: true,
          primary: txn,
          lines,
          totalAmount: lines.reduce((sum, line) => sum + line.amount, 0)
        });
      } else {
        group.items.push({ key: txn.id, isSplit: false, primary: txn, lines: [txn], totalAmount: txn.amount });
      }
    }

    return Array.from(groups.values());
  }

  isExpanded(key: string): boolean {
    return this.expandedSplitGroups.has(key);
  }

  toggleExpand(key: string): void {
    if (this.expandedSplitGroups.has(key)) this.expandedSplitGroups.delete(key);
    else this.expandedSplitGroups.add(key);
  }

  isGroupSelected(item: TransactionListItem): boolean {
    return item.lines.every((line) => this.selectedIds.has(line.id));
  }

  toggleSelectGroup(item: TransactionListItem): void {
    if (this.isGroupSelected(item)) {
      for (const line of item.lines) this.selectedIds.delete(line.id);
    } else {
      for (const line of item.lines) this.selectedIds.add(line.id);
    }
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
    this.resetCalculator();
    this.dialogVisible = true;
  }

  openEditDialog(txn: Transaction): void {
    this.form = {
      id: txn.id,
      categoryId: txn.categoryId,
      accountId: txn.accountId ?? null,
      type: txn.type,
      name: txn.name,
      description: txn.description,
      amount: txn.amount,
      date: txn.date,
      isSplit: false,
      splitGroupId: null,
      splitLines: [],
      calculatorExpression: null
    };
    this.resetCalculator();
    this.dialogVisible = true;
  }

  /** Dispatches to the split or single edit flow depending on what the clicked list item represents. */
  editItem(item: TransactionListItem): void {
    if (!item.isSplit) {
      this.openEditDialog(item.primary);
      return;
    }

    this.form = {
      ...EMPTY_FORM,
      id: null,
      splitGroupId: item.key,
      accountId: item.primary.accountId ?? null,
      type: item.primary.type,
      name: item.primary.name,
      description: item.primary.description,
      date: item.primary.date,
      isSplit: true,
      splitLines: item.lines.map((line) => ({ categoryId: line.categoryId, amount: line.amount }))
    };
    this.resetCalculator();
    this.dialogVisible = true;
  }

  deleteItem(item: TransactionListItem): void {
    if (!item.isSplit) {
      this.deleteTransaction(item.primary);
      return;
    }

    const ids = item.lines.map((line) => line.id);
    this.confirmationService.confirm({
      header: `¿Eliminar transacción dividida (${ids.length} líneas)?`,
      message: 'Esta acción no se puede deshacer.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí',
      rejectLabel: 'No',
      accept: async () => {
        await lastValueFrom(this.transactionService.deleteMany(ids));
        this.messageService.add({ severity: 'success', summary: 'Transacción eliminada' });
      }
    });
  }

  onTypeChange(type: TransactionType): void {
    this.form.type = type;
    this.form.categoryId = '';
    this.form.splitLines = this.form.splitLines.map((line) => ({ ...line, categoryId: '' }));
  }

  onSplitToggle(): void {
    if (this.form.isSplit) {
      if (this.form.splitLines.length < 2) {
        this.form.splitLines = [
          { categoryId: this.form.categoryId || '', amount: this.form.amount },
          { categoryId: '', amount: null }
        ];
      }
    } else {
      this.form.amount = this.splitTotal || this.form.amount;
    }
  }

  addSplitLine(): void {
    this.form.splitLines.push({ categoryId: '', amount: null });
  }

  removeSplitLine(index: number): void {
    if (this.form.splitLines.length <= 2) return;
    this.form.splitLines.splice(index, 1);
  }

  get splitTotal(): number {
    return this.form.splitLines.reduce((sum, line) => sum + (line.amount ?? 0), 0);
  }

  private resetCalculator(): void {
    this.calculatorOpen = false;
    this.calculatorInput = '';
    this.calculatorPreview = null;
    this.calculatorError = null;
  }

  toggleCalculator(): void {
    this.calculatorOpen = !this.calculatorOpen;
    if (this.calculatorOpen) {
      this.calculatorInput = this.form.amount !== null ? String(this.form.amount) : '';
      this.onCalculatorInputChange();
    }
  }

  onCalculatorInputChange(): void {
    if (!this.calculatorInput.trim()) {
      this.calculatorPreview = null;
      this.calculatorError = null;
      return;
    }

    try {
      this.calculatorPreview = evaluateMathExpression(this.calculatorInput);
      this.calculatorError = null;
    } catch (error) {
      this.calculatorPreview = null;
      this.calculatorError = error instanceof Error ? error.message : 'Expresión inválida';
    }
  }

  applyCalculator(): void {
    if (this.calculatorPreview === null) return;
    this.form.amount = Math.round(this.calculatorPreview * 100) / 100;
    this.form.calculatorExpression = this.calculatorInput.trim();
    this.calculatorOpen = false;
  }

  onAmountManuallyChanged(): void {
    this.form.calculatorExpression = null;
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
    if (!this.form.name) {
      this.messageService.add({ severity: 'warn', summary: 'Datos incompletos', detail: 'Ingresá un nombre' });
      return;
    }

    if (this.form.isSplit) {
      await this.saveSplitTransaction();
      return;
    }

    if (!this.form.categoryId || this.form.amount === null || this.form.amount <= 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Datos incompletos',
        detail: 'Completá categoría, nombre y un monto válido'
      });
      return;
    }

    // Editing a transaction that used to be split, now saved as a single line: drop the old group first.
    if (this.form.splitGroupId) {
      const oldIds = this.transactions.filter((t) => t.splitGroupId === this.form.splitGroupId).map((t) => t.id);
      await lastValueFrom(this.transactionService.deleteMany(oldIds));
      this.form.id = null;
    }

    const payload = {
      categoryId: this.form.categoryId,
      accountId: this.form.accountId ?? undefined,
      type: this.form.type,
      name: this.form.name,
      description: this.form.description,
      amount: this.form.amount,
      date: this.form.date
    };

    let transactionId: string;
    if (this.form.id) {
      await lastValueFrom(this.transactionService.update(this.form.id, payload));
      transactionId = this.form.id;
      this.messageService.add({ severity: 'success', summary: 'Transacción actualizada' });
    } else {
      const created = await lastValueFrom(this.transactionService.create(payload));
      transactionId = created.id;
      this.messageService.add({ severity: 'success', summary: 'Transacción creada' });
    }

    if (this.form.calculatorExpression) {
      await lastValueFrom(
        this.transactionCalculationService.create({
          transactionId,
          expression: this.form.calculatorExpression,
          result: this.form.amount
        })
      );
    }

    this.dialogVisible = false;
  }

  private async saveSplitTransaction(): Promise<void> {
    const validLines = this.form.splitLines.filter((line) => line.categoryId && line.amount !== null && line.amount > 0);
    if (validLines.length < 2) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Datos incompletos',
        detail: 'Agregá al menos 2 líneas con categoría y monto'
      });
      return;
    }

    const isUpdate = this.form.splitGroupId !== null || this.form.id !== null;

    if (this.form.splitGroupId) {
      const oldIds = this.transactions.filter((t) => t.splitGroupId === this.form.splitGroupId).map((t) => t.id);
      await lastValueFrom(this.transactionService.deleteMany(oldIds));
    } else if (this.form.id) {
      await lastValueFrom(this.transactionService.delete(this.form.id));
      await lastValueFrom(this.transactionCalculationService.deleteForTransaction(this.form.id));
    }

    const groupId = this.form.splitGroupId ?? this.generateSplitGroupId();
    for (const line of validLines) {
      await lastValueFrom(
        this.transactionService.create({
          categoryId: line.categoryId,
          accountId: this.form.accountId ?? undefined,
          type: this.form.type,
          name: this.form.name,
          description: this.form.description,
          amount: line.amount!,
          date: this.form.date,
          splitGroupId: groupId
        })
      );
    }

    this.messageService.add({ severity: 'success', summary: isUpdate ? 'Transacción actualizada' : 'Transacción dividida creada' });
    this.dialogVisible = false;
  }

  private generateSplitGroupId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
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
        await lastValueFrom(this.transactionCalculationService.deleteForTransaction(txn.id));
        this.messageService.add({ severity: 'success', summary: 'Transacción eliminada' });
      }
    });
  }

  isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  toggleSelect(id: string): void {
    if (this.selectedIds.has(id)) this.selectedIds.delete(id);
    else this.selectedIds.add(id);
  }

  get allVisibleSelected(): boolean {
    return this.filteredTransactions.length > 0 && this.filteredTransactions.every((txn) => this.selectedIds.has(txn.id));
  }

  toggleSelectAllVisible(): void {
    if (this.allVisibleSelected) {
      for (const txn of this.filteredTransactions) this.selectedIds.delete(txn.id);
    } else {
      for (const txn of this.filteredTransactions) this.selectedIds.add(txn.id);
    }
  }

  clearSelection(): void {
    this.selectedIds.clear();
  }

  /** The type shared by every selected transaction, or null when the selection mixes income and expense. */
  get selectedCommonType(): TransactionType | null {
    const selected = this.filteredTransactions.filter((txn) => this.selectedIds.has(txn.id));
    if (selected.length === 0) return null;
    const first = selected[0].type;
    return selected.every((txn) => txn.type === first) ? first : null;
  }

  bulkDeleteSelected(): void {
    const count = this.selectedIds.size;
    this.confirmationService.confirm({
      header: `¿Eliminar ${count} ${count === 1 ? 'transacción' : 'transacciones'}?`,
      message: 'Esta acción no se puede deshacer.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí',
      rejectLabel: 'No',
      accept: async () => {
        await lastValueFrom(this.transactionService.deleteMany([...this.selectedIds]));
        this.messageService.add({ severity: 'success', summary: 'Transacciones eliminadas' });
        this.clearSelection();
      }
    });
  }

  openBulkRecategorizeDialog(): void {
    this.bulkRecategorizeCategoryId = null;
    this.bulkRecategorizeDialogVisible = true;
  }

  async saveBulkRecategorize(): Promise<void> {
    if (!this.bulkRecategorizeCategoryId) {
      this.messageService.add({ severity: 'warn', summary: 'Elegí una categoría' });
      return;
    }

    await lastValueFrom(this.transactionService.updateCategoryMany([...this.selectedIds], this.bulkRecategorizeCategoryId));
    this.messageService.add({ severity: 'success', summary: 'Transacciones recategorizadas' });
    this.bulkRecategorizeDialogVisible = false;
    this.clearSelection();
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
