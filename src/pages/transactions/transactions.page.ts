import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject, takeUntil, combineLatest } from 'rxjs';
import { Transaction, Account, Category } from '../../models';
import { TransactionService } from '../../services/transaction.service';
import { AccountService } from '../../services/account.service';
import { CategoryService } from '../../services/category.service';
import { CsvService } from '../../services/csv.service';
import { ExchangeRateService } from '../../services/exchange-rate.service';
import { CurrencyDisplayService, FormattedCurrency } from '../../services/currency-display.service';
import { PreferencesService } from '../../services/preferences.service';

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

  transactions: TransactionWithDetails[] = [];
  filteredTransactions: TransactionWithDetails[] = [];
  accounts: Account[] = [];
  categories: Category[] = [];

  showDialog = false;
  showImportDialog = false;
  showCategoryDialog = false;
  showAccountDialog = false;
  editingTransaction: Transaction | null = null;

  currencies = [
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
    { code: 'ARS', symbol: '$', name: 'Argentine Peso' },
    { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
    { code: 'MXN', symbol: '$', name: 'Mexican Peso' },
    { code: 'COP', symbol: '$', name: 'Colombian Peso' },
    { code: 'CLP', symbol: '$', name: 'Chilean Peso' }
  ];

  formData = {
    accountId: '',
    categoryId: '',
    type: 'expense' as 'income' | 'expense',
    amount: 0,
    currency: 'USD',
    description: '',
    date: ''
  };

  categoryFormData = {
    name: '',
    type: 'expense' as 'income' | 'expense',
    color: '#3b82f6',
    icon: 'tag'
  };

  accountFormData = {
    name: '',
    type: 'bank' as 'bank' | 'cash' | 'credit' | 'savings' | 'investment',
    balance: 0,
    currency: 'USD',
    color: '#3b82f6',
    icon: 'wallet'
  };

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

  selectedFile: File | null = null;

  availableColors = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#6366f1'
  ];

  availableIcons = [
    'wallet', 'shopping-cart', 'home', 'car', 'heart', 'gift',
    'coffee', 'book', 'briefcase', 'chart-line', 'credit-card',
    'dollar', 'users', 'plane', 'building', 'star', 'tag',
    'bolt', 'ticket', 'medical', 'gamepad', 'music'
  ];

  accountTypes: Array<{ value: string; label: string }> = [
    { value: 'bank', label: 'Bank' },
    { value: 'cash', label: 'Cash' },
    { value: 'credit', label: 'Credit Card' },
    { value: 'savings', label: 'Savings' },
    { value: 'investment', label: 'Investment' }
  ];

  constructor(
    private transactionService: TransactionService,
    private accountService: AccountService,
    private categoryService: CategoryService,
    private csvService: CsvService,
    private exchangeRateService: ExchangeRateService,
    private currencyDisplayService: CurrencyDisplayService,
    private preferencesService: PreferencesService
  ) {}

  ngOnInit(): void {
    // Load data
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

    // Convertir todas las transacciones a la moneda preferida antes de sumar
    this.stats.totalIncome = this.filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => {
        const convertedAmount = this.exchangeRateService.convertToPreferredCurrency(
          t.amount,
          t.currency,
          preferredCurrency
        );
        return sum + convertedAmount;
      }, 0);

    this.stats.totalExpense = this.filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => {
        const convertedAmount = this.exchangeRateService.convertToPreferredCurrency(
          t.amount,
          t.currency,
          preferredCurrency
        );
        return sum + convertedAmount;
      }, 0);

    this.stats.balance = this.stats.totalIncome - this.stats.totalExpense;
    this.stats.count = this.filteredTransactions.length;
  }

  openCreateDialog(): void {
    this.editingTransaction = null;
    const today = new Date().toISOString().split('T')[0];
    this.formData = {
      accountId: this.accounts[0]?.id || '',
      categoryId: this.categories.filter(c => c.type === 'expense')[0]?.id || '',
      type: 'expense',
      amount: 0,
      currency: this.accounts[0]?.currency || 'USD',
      description: '',
      date: today
    };
    this.showDialog = true;
  }

  openEditDialog(transaction: Transaction): void {
    this.editingTransaction = transaction;
    this.formData = {
      accountId: transaction.accountId,
      categoryId: transaction.categoryId,
      type: transaction.type,
      amount: transaction.amount,
      currency: transaction.currency,
      description: transaction.description,
      date: new Date(transaction.date).toISOString().split('T')[0]
    };
    this.showDialog = true;
  }

  closeDialog(): void {
    this.showDialog = false;
    this.editingTransaction = null;
  }

  saveTransaction(): void {
    if (!this.formData.accountId || !this.formData.categoryId || this.formData.amount <= 0) {
      return;
    }

    const txnData = {
      ...this.formData,
      date: new Date(this.formData.date)
    };

    if (this.editingTransaction) {
      this.transactionService.updateTransaction(this.editingTransaction.id, txnData);
    } else {
      this.transactionService.createTransaction(txnData);
    }

    this.closeDialog();
  }

  deleteTransaction(transaction: Transaction): void {
    if (confirm(`Are you sure you want to delete this transaction?`)) {
      this.transactionService.deleteTransaction(transaction.id);
    }
  }

  onTypeChange(): void {
    // Update available categories based on type
    const availableCategories = this.categories.filter(c => c.type === this.formData.type);
    if (availableCategories.length > 0) {
      this.formData.categoryId = availableCategories[0].id;
    }
  }

  onAccountChange(): void {
    // Update currency based on selected account
    const account = this.accounts.find(a => a.id === this.formData.accountId);
    if (account) {
      this.formData.currency = account.currency;
    }
  }

  getAvailableCategories(): Category[] {
    return this.categories.filter(c => c.type === this.formData.type);
  }

  // Quick create category
  openQuickCreateCategory(): void {
    this.categoryFormData = {
      name: '',
      type: this.formData.type,
      color: '#3b82f6',
      icon: 'tag'
    };
    this.showCategoryDialog = true;
  }

  closeCategoryDialog(): void {
    this.showCategoryDialog = false;
  }

  saveQuickCategory(): void {
    if (!this.categoryFormData.name) return;

    const newCategory = this.categoryService.createCategory(this.categoryFormData);
    this.formData.categoryId = newCategory.id;
    this.closeCategoryDialog();
  }

  // Quick create account
  openQuickCreateAccount(): void {
    this.accountFormData = {
      name: '',
      type: 'bank',
      balance: 0,
      currency: this.formData.currency,
      color: '#3b82f6',
      icon: 'wallet'
    };
    this.showAccountDialog = true;
  }

  closeAccountDialog(): void {
    this.showAccountDialog = false;
  }

  saveQuickAccount(): void {
    if (!this.accountFormData.name) return;

    const newAccount = this.accountService.createAccount(this.accountFormData);
    this.formData.accountId = newAccount.id;
    this.formData.currency = newAccount.currency;
    this.closeAccountDialog();
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

      alert(`Successfully imported ${transactions.length} transactions`);
      this.showImportDialog = false;
    } catch (error) {
      alert(`Error importing CSV: ${error}`);
    }
  }

  formatCurrency(amount: number, currency?: string): string {
    const preferredCurrency = this.preferencesService.getPreferredCurrency();
    return this.currencyDisplayService.formatAmount(amount, currency || preferredCurrency);
  }

  formatCurrencyWithOriginal(amount: number, originalCurrency: string): FormattedCurrency {
    return this.currencyDisplayService.formatWithPreferredCurrency(amount, originalCurrency);
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(date));
  }
}
