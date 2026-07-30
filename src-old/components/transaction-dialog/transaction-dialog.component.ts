import { Component, EventEmitter, OnInit, OnDestroy, Output } from '@angular/core';
import { Subject, takeUntil, combineLatest } from 'rxjs';
import { Transaction, Account, Category } from '../../models';
import { resolveRateMode } from '../../models/transaction.model';
import { TransactionService } from '../../services/transaction.service';
import { AccountService } from '../../services/account.service';
import { CategoryService } from '../../services/category.service';
import { ExchangeRateService } from '../../services/exchange-rate.service';
import { PreferencesService } from '../../services/preferences.service';
import { ToastService } from '../../services/toast.service';
import { SUPPORTED_CURRENCIES } from '../../constants/currencies';

@Component({
  selector: 'app-transaction-dialog',
  templateUrl: './transaction-dialog.component.html',
  styleUrls: ['./transaction-dialog.component.scss'],
  standalone: false
})
export class TransactionDialogComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  @Output() saved = new EventEmitter<void>();

  showDialog = false;
  showCategoryDialog = false;
  showAccountDialog = false;
  editingTransaction: Transaction | null = null;
  selectedMode: 'live' | 'frozen' | 'transfer' = 'live';

  accounts: Account[] = [];
  categories: Category[] = [];
  currencies = SUPPORTED_CURRENCIES;

  formData = {
    accountId: '',
    categoryId: '',
    type: 'expense' as 'income' | 'expense',
    amount: 0,
    currency: 'ARS',
    description: '',
    date: '',
    rateMode: 'live' as 'live' | 'frozen' | 'transfer',
    convertedAmount: 0,
    usdRate: 0,
    conversionSource: '' as 'api' | 'cache' | 'manual' | '',
    toAccountId: '',
    toAmount: 0,
  };

  categoryFormData = {
    name: '',
    type: 'expense' as 'income' | 'expense',
    color: '#3b82f6',
    icon: 'pi-tag'
  };

  accountFormData = {
    name: '',
    type: 'bank' as 'bank' | 'cash' | 'credit' | 'savings' | 'investment',
    balance: 0,
    currency: 'ARS',
    color: '#3b82f6',
    icon: 'wallet'
  };

  availableColors = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#6366f1'
  ];

  availableIcons = [
    'address-book', 'align-center', 'align-justify', 'align-left', 'align-right',
    'amazon', 'android', 'angle-double-down', 'angle-double-left', 'angle-double-right',
    'angle-double-up', 'angle-down', 'angle-left', 'angle-right', 'angle-up',
    'apple', 'arrow-circle-down', 'arrow-circle-left', 'arrow-circle-right', 'arrow-circle-up',
    'arrow-down', 'arrow-down-left', 'arrow-down-left-and-arrow-up-right-to-center', 'arrow-down-right', 'arrow-left',
    'arrow-right', 'arrow-right-arrow-left', 'arrow-up', 'arrow-up-left', 'arrow-up-right',
    'arrow-up-right-and-arrow-down-left-from-center', 'arrows-alt', 'arrows-h', 'arrows-v', 'asterisk',
    'at', 'backward', 'ban', 'barcode', 'bars',
    'bell', 'bell-slash', 'bitcoin', 'bolt', 'book',
    'bookmark', 'bookmark-fill', 'box', 'briefcase', 'building',
    'building-columns', 'bullseye', 'calculator', 'calendar', 'calendar-clock',
    'calendar-minus', 'calendar-plus', 'calendar-times', 'camera', 'car',
    'caret-down', 'caret-left', 'caret-right', 'caret-up', 'cart-arrow-down',
    'cart-minus', 'cart-plus', 'chart-bar', 'chart-line', 'chart-pie',
    'chart-scatter', 'check', 'check-circle', 'check-square', 'chevron-circle-down',
    'chevron-circle-left', 'chevron-circle-right', 'chevron-circle-up', 'chevron-down', 'chevron-left',
    'chevron-right', 'chevron-up', 'circle', 'circle-fill', 'circle-off',
    'circle-on', 'clipboard', 'clock', 'clone', 'cloud',
    'cloud-download', 'cloud-upload', 'code', 'cog', 'comment',
    'comments', 'compass', 'copy', 'credit-card', 'crown',
    'database', 'delete-left', 'desktop', 'directions', 'directions-alt',
    'discord', 'dollar', 'download', 'eject', 'ellipsis-h',
    'ellipsis-v', 'envelope', 'equals', 'eraser', 'ethereum',
    'euro', 'exclamation-circle', 'exclamation-triangle', 'expand', 'external-link',
    'eye', 'eye-slash', 'face-smile', 'facebook', 'fast-backward',
    'fast-forward', 'file', 'file-arrow-up', 'file-check', 'file-edit',
    'file-excel', 'file-export', 'file-import', 'file-o', 'file-pdf',
    'file-plus', 'file-word', 'filter', 'filter-fill', 'filter-slash',
    'flag', 'flag-fill', 'folder', 'folder-open', 'folder-plus',
    'forward', 'gauge', 'gift', 'github', 'globe',
    'google', 'graduation-cap', 'hammer', 'hashtag', 'headphones',
    'heart', 'heart-fill', 'history', 'home', 'hourglass',
    'id-card', 'image', 'images', 'inbox', 'indian-rupee',
    'info', 'info-circle', 'instagram', 'key', 'language',
    'lightbulb', 'link', 'linkedin', 'list', 'list-check',
    'lock', 'lock-open', 'map', 'map-marker', 'mars',
    'megaphone', 'microchip', 'microchip-ai', 'microphone', 'microsoft',
    'minus', 'minus-circle', 'mobile', 'money-bill', 'moon',
    'objects-column', 'palette', 'paperclip', 'pause', 'pause-circle',
    'paypal', 'pen-to-square', 'pencil', 'percentage', 'phone',
    'pinterest', 'play', 'play-circle', 'plus', 'plus-circle',
    'pound', 'power-off', 'prime', 'print', 'qrcode',
    'question', 'question-circle', 'receipt', 'reddit', 'refresh',
    'replay', 'reply', 'save', 'search', 'search-minus',
    'search-plus', 'send', 'server', 'share-alt', 'shield',
    'shop', 'shopping-bag', 'shopping-cart', 'sign-in', 'sign-out',
    'sitemap', 'slack', 'sliders-h', 'sliders-v', 'sort',
    'sort-alpha-down', 'sort-alpha-down-alt', 'sort-alpha-up', 'sort-alpha-up-alt', 'sort-alt',
    'sort-alt-slash', 'sort-amount-down', 'sort-amount-down-alt', 'sort-amount-up', 'sort-amount-up-alt',
    'sort-down', 'sort-down-fill', 'sort-numeric-down', 'sort-numeric-down-alt', 'sort-numeric-up',
    'sort-numeric-up-alt', 'sort-up', 'sort-up-fill', 'sparkles', 'spinner',
    'spinner-dotted', 'star', 'star-fill', 'star-half', 'star-half-fill',
    'step-backward', 'step-backward-alt', 'step-forward', 'step-forward-alt', 'stop',
    'stop-circle', 'stopwatch', 'sun', 'sync', 'table',
    'tablet', 'tag', 'tags', 'telegram', 'th-large',
    'thumbs-down', 'thumbs-down-fill', 'thumbs-up', 'thumbs-up-fill', 'thumbtack',
    'ticket', 'tiktok', 'times', 'times-circle', 'trash',
    'trophy', 'truck', 'turkish-lira', 'twitch', 'twitter',
    'undo', 'unlock', 'upload', 'user', 'user-edit',
    'user-minus', 'user-plus', 'users', 'venus', 'verified',
    'video', 'vimeo', 'volume-down', 'volume-off', 'volume-up',
    'wallet', 'warehouse', 'wave-pulse', 'whatsapp', 'wifi',
    'window-maximize', 'window-minimize', 'wrench', 'youtube'
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
    private exchangeRateService: ExchangeRateService,
    private preferencesService: PreferencesService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    combineLatest([
      this.accountService.accounts$,
      this.categoryService.categories$
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([accounts, categories]) => {
        this.accounts = accounts;
        this.categories = categories;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  open(transaction?: Transaction): void {
    if (transaction) {
      this.openEditDialog(transaction);
    } else {
      this.openCreateDialog();
    }
  }

  private openCreateDialog(): void {
    this.editingTransaction = null;
    this.selectedMode = 'live';
    const defaultAccount = this.accounts[0];

    this.formData = {
      accountId: defaultAccount?.id || '',
      categoryId: this.categories.filter(c => c.type === 'expense')[0]?.id || '',
      type: 'expense',
      amount: 0,
      currency: defaultAccount?.currency || 'ARS',
      description: '',
      date: this.formatDateForInput(new Date()),
      rateMode: 'live',
      convertedAmount: 0,
      usdRate: 0,
      conversionSource: '',
      toAccountId: '',
      toAmount: 0,
    };
    this.showDialog = true;
  }

  private openEditDialog(transaction: Transaction): void {
    this.editingTransaction = transaction;
    const mode = resolveRateMode(transaction);
    this.selectedMode = mode === 'transfer' ? 'transfer' : mode;

    this.formData = {
      accountId: transaction.accountId,
      categoryId: transaction.categoryId,
      type: transaction.type,
      amount: transaction.amount,
      currency: transaction.currency,
      description: transaction.description,
      date: this.formatDateForInput(new Date(transaction.date)),
      rateMode: mode,
      convertedAmount: transaction.convertedAmount || 0,
      usdRate: transaction.usdRate || 0,
      conversionSource: transaction.conversionSource || '',
      toAccountId: '',
      toAmount: 0,
    };
    if (mode === 'live') {
      this.calculateConversion();
    }
    this.showDialog = true;
  }

  closeDialog(): void {
    this.showDialog = false;
    this.editingTransaction = null;
  }

  onModeSelect(mode: 'live' | 'frozen' | 'transfer'): void {
    this.selectedMode = mode;
    this.formData.rateMode = mode;
    if (mode === 'live') {
      this.formData.convertedAmount = 0;
      this.formData.usdRate = 0;
      this.formData.conversionSource = '';
      this.formData.toAccountId = '';
      this.formData.toAmount = 0;
    } else {
      this.calculateConversion();
    }
  }

  calculateConversion(): void {
    if (!this.formData.amount || !this.formData.currency) {
      this.formData.convertedAmount = 0;
      this.formData.usdRate = 0;
      this.formData.conversionSource = '';
      return;
    }

    const preferredCurrency = this.preferencesService.getPreferredCurrency();
    const ratesInfo = this.exchangeRateService.getRatesInfo();

    if (this.formData.currency === preferredCurrency) {
      this.formData.usdRate = 1;
      this.formData.convertedAmount = this.formData.amount;
    } else {
      this.formData.usdRate = this.exchangeRateService.getExchangeRate(this.formData.currency, preferredCurrency);
      this.formData.convertedAmount = this.exchangeRateService.convertToPreferredCurrency(
        this.formData.amount,
        this.formData.currency,
        preferredCurrency
      );
    }

    if (ratesInfo) {
      const today = new Date().toISOString().split('T')[0];
      const rateDate = new Date(ratesInfo.date).toISOString().split('T')[0];
      this.formData.conversionSource = rateDate === today ? 'api' : 'cache';
    } else {
      this.formData.conversionSource = 'api';
    }

    if (this.selectedMode === 'transfer') {
      this.recalcToAmount();
    }
  }

  onAmountOrCurrencyChange(): void {
    if (this.selectedMode !== 'live') {
      this.calculateConversion();
    }
  }

  onFrozenRateChange(): void {
    this.formData.conversionSource = 'manual';
    const preferredCurrency = this.preferencesService.getPreferredCurrency();

    if (this.formData.amount > 0 && this.formData.usdRate > 0) {
      if (this.formData.currency === preferredCurrency) {
        this.formData.convertedAmount = this.formData.amount;
      } else {
        this.formData.convertedAmount = this.formData.amount * this.formData.usdRate;
      }
    }

    if (this.selectedMode === 'transfer') {
      this.recalcToAmount();
    }
  }

  onToAccountChange(): void {
    this.recalcToAmount();
  }

  private recalcToAmount(): void {
    const toAccount = this.accounts.find(a => a.id === this.formData.toAccountId);
    if (!toAccount) return;

    if (toAccount.currency === this.formData.currency) {
      this.formData.toAmount = this.formData.amount;
    } else {
      this.formData.toAmount = this.formData.convertedAmount;
    }
  }

  getToAccountCurrency(): string {
    return this.accounts.find(a => a.id === this.formData.toAccountId)?.currency || '';
  }

  isTransferCurrencyExchange(): boolean {
    const toAccount = this.accounts.find(a => a.id === this.formData.toAccountId);
    return !!toAccount && toAccount.currency !== this.formData.currency;
  }

  getPreferredCurrency(): string {
    return this.preferencesService.getPreferredCurrency();
  }

  getConversionSourceLabel(): string {
    switch (this.formData.conversionSource) {
      case 'api': return 'API (Today)';
      case 'cache': return 'Cache (Yesterday)';
      case 'manual': return 'Manual';
      default: return 'N/A';
    }
  }

  onTypeChange(): void {
    const available = this.categories.filter(c => c.type === this.formData.type);
    if (available.length > 0) {
      this.formData.categoryId = available[0].id;
    }
  }

  onAccountChange(): void {
    const account = this.accounts.find(a => a.id === this.formData.accountId);
    if (account) {
      this.formData.currency = account.currency;
      if (this.selectedMode !== 'live') {
        this.calculateConversion();
      }
    }
  }

  getAvailableCategories(): Category[] {
    return this.categories.filter(c => c.type === this.formData.type);
  }

  saveTransaction(): void {
    if (!this.formData.accountId || !this.formData.categoryId || this.formData.amount <= 0) return;

    const date = new Date(this.formData.date);

    if (this.selectedMode === 'transfer') {
      if (!this.formData.toAccountId) return;
      const isCurrencyExchange = this.isTransferCurrencyExchange();
      const allRates = this.exchangeRateService.getAllExchangeRates(this.formData.currency);
      if (isCurrencyExchange && this.formData.usdRate > 0) {
        const preferred = this.preferencesService.getPreferredCurrency();
        const key = preferred as keyof typeof allRates;
        if (key in allRates) allRates[key] = this.formData.usdRate;
      }
      this.transactionService.createTransfer({
        fromAccountId: this.formData.accountId,
        toAccountId: this.formData.toAccountId,
        fromAmount: this.formData.amount,
        toAmount: this.formData.toAmount,
        fromCurrency: this.formData.currency,
        toCurrency: this.getToAccountCurrency(),
        isCurrencyExchange,
        convertedAmount: this.formData.convertedAmount,
        exchangeRates: allRates,
        usdRate: isCurrencyExchange ? this.formData.usdRate : 1,
        conversionSource: isCurrencyExchange ? (this.formData.conversionSource as 'api' | 'cache' | 'manual') : '',
        description: this.formData.description,
        date,
        categoryId: this.formData.categoryId,
      });
      this.closeDialog();
      this.saved.emit();
      return;
    }

    const isFrozen = this.selectedMode === 'frozen';
    const allRates = this.exchangeRateService.getAllExchangeRates(this.formData.currency);

    if (isFrozen && this.formData.conversionSource === 'manual' && this.formData.usdRate > 0) {
      const preferred = this.preferencesService.getPreferredCurrency();
      const key = preferred as keyof typeof allRates;
      if (key in allRates) allRates[key] = this.formData.usdRate;
    }

    const txnData: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> = {
      accountId: this.formData.accountId,
      categoryId: this.formData.categoryId,
      type: this.formData.type,
      amount: this.formData.amount,
      currency: this.formData.currency,
      description: this.formData.description,
      date,
      rateMode: isFrozen ? 'frozen' : 'live',
      convertedAmount: isFrozen && this.formData.convertedAmount > 0 ? this.formData.convertedAmount : undefined,
      usdRate: isFrozen && this.formData.usdRate > 0 ? this.formData.usdRate : undefined,
      conversionSource: isFrozen ? (this.formData.conversionSource as 'api' | 'cache' | 'manual') || undefined : undefined,
      exchangeRates: allRates,
    };

    if (this.editingTransaction) {
      this.transactionService.updateTransaction(this.editingTransaction.id, txnData);
    } else {
      this.transactionService.createTransaction(txnData);
    }

    this.closeDialog();
    this.saved.emit();
  }

  // Quick create category
  openQuickCreateCategory(): void {
    this.categoryFormData = {
      name: '',
      type: this.formData.type,
      color: '#3b82f6',
      icon: 'pi-tag'
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
      icon: 'pi-wallet'
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

  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }
}
