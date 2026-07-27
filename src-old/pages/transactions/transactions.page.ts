import { Component, OnInit, OnDestroy, HostListener, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil, combineLatest } from 'rxjs';
import { TransactionDialogComponent } from '../../components/transaction-dialog/transaction-dialog.component';
import { Transaction, Account, Category } from '../../models';
import { resolveRateMode } from '../../models/transaction.model';
import { TransactionService } from '../../services/transaction.service';
import { AccountService } from '../../services/account.service';
import { CategoryService } from '../../services/category.service';
import { CsvService } from '../../services/csv.service';
import { ExchangeRateService } from '../../services/exchange-rate.service';
import { CurrencyDisplayService, FormattedCurrency } from '../../services/currency-display.service';
import { PreferencesService } from '../../services/preferences.service';
import { ToastService } from '../../services/toast.service';

interface TransactionWithDetails extends Transaction {
  accountName: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
}

@Component({
  selector: 'app-transactions',
  templateUrl: './transactions.page.html',
  styleUrls: ['./transactions.page.scss'],
  standalone: false
})
export class TransactionsPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  @ViewChild('txnDialog') txnDialog!: TransactionDialogComponent;

  transactions: TransactionWithDetails[] = [];
  filteredTransactions: TransactionWithDetails[] = [];
  accounts: Account[] = [];
  categories: Category[] = [];

  showImportDialog = false;

  filters = {
    type: 'all' as 'all' | 'income' | 'expense',
    accountId: 'all',
    categoryId: 'all',
    searchText: '',
    startDate: null as Date | null,
    endDate: null as Date | null
  };

  stats = {
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
    count: 0
  };

  csvDropdownOpen = false;
  selectedFile: File | null = null;

  constructor(
    private transactionService: TransactionService,
    private accountService: AccountService,
    private categoryService: CategoryService,
    private csvService: CsvService,
    private exchangeRateService: ExchangeRateService,
    private currencyDisplayService: CurrencyDisplayService,
    private preferencesService: PreferencesService,
    private toastService: ToastService,
    private route: ActivatedRoute
  ) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.csv-dropdown')) {
      this.csvDropdownOpen = false;
    }
  }

  ngOnInit(): void {
    const openNew = this.route.snapshot.queryParamMap.get('new') === '1';
    let dialogOpened = false;

    combineLatest([
      this.transactionService.transactions$,
      this.accountService.accounts$,
      this.categoryService.categories$
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([transactions, accounts, categories]) => {
        this.accounts = accounts;
        this.categories = categories;

        this.transactions = transactions.map(txn => {
          const account = accounts.find(a => a.id === txn.accountId);
          const category = categories.find(c => c.id === txn.categoryId);

          return {
            ...txn,
            accountName: account?.name || 'Unknown',
            categoryName: category?.name || 'Unknown',
            categoryColor: category?.color || '#6b7280',
            categoryIcon: category?.icon || 'tag'
          };
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        this.applyFilters();

        if (openNew && !dialogOpened) {
          dialogOpened = true;
          this.openCreateDialog();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  applyFilters(): void {
    let filtered = [...this.transactions];

    // Filter by type
    if (this.filters.type !== 'all') {
      filtered = filtered.filter(t => t.type === this.filters.type);
    }

    // Filter by account
    if (this.filters.accountId !== 'all') {
      filtered = filtered.filter(t => t.accountId === this.filters.accountId);
    }

    // Filter by category
    if (this.filters.categoryId !== 'all') {
      filtered = filtered.filter(t => t.categoryId === this.filters.categoryId);
    }

    // Filter by search text
    if (this.filters.searchText) {
      const search = this.filters.searchText.toLowerCase();
      filtered = filtered.filter(t =>
        t.description.toLowerCase().includes(search) ||
        t.accountName.toLowerCase().includes(search) ||
        t.categoryName.toLowerCase().includes(search)
      );
    }

    // Filter by date range
    if (this.filters.startDate) {
      filtered = filtered.filter(t => new Date(t.date) >= this.filters.startDate!);
    }
    if (this.filters.endDate) {
      filtered = filtered.filter(t => new Date(t.date) <= this.filters.endDate!);
    }

    this.filteredTransactions = filtered;
    this.calculateStats();
  }

  calculateStats(): void {
    const preferredCurrency = this.preferencesService.getPreferredCurrency();

    this.stats.totalIncome = this.filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + this.getStatAmount(t, preferredCurrency), 0);

    this.stats.totalExpense = this.filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + this.getStatAmount(t, preferredCurrency), 0);

    this.stats.balance = this.stats.totalIncome - this.stats.totalExpense;
    this.stats.count = this.filteredTransactions.length;
  }

  private getStatAmount(t: Transaction, preferredCurrency: string): number {
    const mode = resolveRateMode(t);
    if (mode === 'transfer') return 0;
    if (mode === 'frozen') {
      if (t.currency === preferredCurrency) return t.amount;
      return t.convertedAmount ?? this.exchangeRateService.convertToPreferredCurrency(t.amount, t.currency, preferredCurrency);
    }
    return this.exchangeRateService.convertToPreferredCurrency(t.amount, t.currency, preferredCurrency);
  }

  openCreateDialog(): void {
    this.txnDialog.open();
  }

  openEditDialog(transaction: Transaction): void {
    this.txnDialog.open(transaction);
  }

  async deleteTransaction(transaction: Transaction): Promise<void> {
    const shouldDelete = await this.toastService.confirm(
      'Esta acción no se puede deshacer',
      '¿Eliminar transacción?'
    );

    if (shouldDelete) {
      this.transactionService.deleteTransaction(transaction.id);
      this.toastService.success('Transacción eliminada', 'La transacción ha sido eliminada exitosamente');
    }
  }

  clearFilters(): void {
    this.filters = {
      type: 'all',
      accountId: 'all',
      categoryId: 'all',
      searchText: '',
      startDate: null,
      endDate: null
    };
    this.applyFilters();
  }

  exportToCSV(): void {
    this.csvService.exportTransactionsToCsv(
      this.filteredTransactions,
      this.accounts,
      this.categories
    );
  }

  openImportDialog(): void {
    this.selectedFile = null;
    this.showImportDialog = true;
  }

  onFileSelected(event: any): void {
    this.selectedFile = event.target.files[0];
  }

  async importCSV(): Promise<void> {
    if (!this.selectedFile) return;

    try {
      const transactions = await this.csvService.importTransactionsFromCsv(
        this.selectedFile,
        this.accounts,
        this.categories
      );

      transactions.forEach(txn => {
        this.transactionService.createTransaction(txn);
      });

      this.toastService.success('Importación exitosa', `Se importaron ${transactions.length} transacciones correctamente`);
      this.showImportDialog = false;
    } catch (error) {
      this.toastService.error('Error al importar CSV', `${error}`);
    }
  }

  getPreferredCurrency(): string {
    return this.preferencesService.getPreferredCurrency();
  }

  formatCurrency(amount: number, currency?: string): string {
    const preferredCurrency = this.preferencesService.getPreferredCurrency();
    return this.currencyDisplayService.formatAmount(amount, currency || preferredCurrency);
  }

  formatCurrencyWithOriginal(amount: number, originalCurrency: string, exchangeRates?: { ARS: number, USD: number, EUR: number, BRL: number }): FormattedCurrency {
    return this.currencyDisplayService.formatWithDualCurrency(amount, originalCurrency, exchangeRates);
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  }
}
