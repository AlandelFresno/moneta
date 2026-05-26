import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { Category } from '../../models';
import { CategoryService } from '../../services/category.service';
import { CsvService } from '../../services/csv.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-categories',
  templateUrl: './categories.page.html',
  styleUrls: ['./categories.page.scss'],
  standalone: false
})
export class CategoriesPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  categories: Category[] = [];
  incomeCategories: Category[] = [];
  expenseCategories: Category[] = [];

  showDialog = false;
  editingCategory: Category | null = null;

  formData = {
    name: '',
    type: 'expense' as 'income' | 'expense',
    color: '#3b82f6',
    icon: 'tag'
  };

  availableColors = [
    '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#6366f1',
    '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16'
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

  constructor(
    private categoryService: CategoryService,
    private csvService: CsvService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.categoryService.categories$
      .pipe(takeUntil(this.destroy$))
      .subscribe(categories => {
        this.categories = categories;
        this.incomeCategories = categories.filter(c => c.type === 'income');
        this.expenseCategories = categories.filter(c => c.type === 'expense');
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  openCreateDialog(): void {
    this.editingCategory = null;
    this.formData = {
      name: '',
      type: 'expense',
      color: '#3b82f6',
      icon: 'tag'
    };
    this.showDialog = true;
  }

  openEditDialog(category: Category): void {
    this.editingCategory = category;
    this.formData = {
      name: category.name,
      type: category.type,
      color: category.color,
      icon: category.icon
    };
    this.showDialog = true;
  }

  getCategoryIconClass(icon: string): string {
    // Handle all stored formats: 'heart', 'pi-heart', 'pi pi-heart'
    const name = icon.replace(/^pi\s+pi-/, '').replace(/^pi-/, '');
    return `pi pi-${name}`;
  }

  closeDialog(): void {
    this.showDialog = false;
    this.editingCategory = null;
  }

  saveCategory(): void {
    if (!this.formData.name.trim()) return;

    if (this.editingCategory) {
      this.categoryService.updateCategory(this.editingCategory.id, this.formData);
    } else {
      this.categoryService.createCategory(this.formData);
    }

    this.closeDialog();
  }

  async deleteCategory(category: Category): Promise<void> {
    const shouldDelete = await this.toastService.confirm(
      `Esta acción eliminará la categoría "${category.name}" y no se puede deshacer`,
      '¿Eliminar categoría?'
    );

    if (shouldDelete) {
      this.categoryService.deleteCategory(category.id);
      this.toastService.success('Categoría eliminada', 'La categoría ha sido eliminada exitosamente');
    }
  }

  exportToCSV(): void {
    this.csvService.exportCategoriesToCsv(this.categories);
  }
}
