import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, lastValueFrom } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ConfirmationService, MessageService } from 'primeng/api';

import { Category, CategoryType } from '../../core/types/category.types';
import { CategoryService } from '../../services/category.service';
import { IconComponent } from '../../shared/icon/icon.component';

interface CategoryForm {
  id: string | null;
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
}

const ICON_OPTIONS = [
  // money & finance
  'tag', 'tags', 'wallet', 'money-bill', 'dollar', 'euro', 'pound', 'indian-rupee',
  'turkish-lira', 'bitcoin', 'ethereum', 'credit-card', 'percentage', 'receipt',
  'calculator', 'chart-line', 'chart-pie', 'chart-bar', 'chart-scatter', 'gauge',
  'bullseye',
  // work & business
  'briefcase', 'building', 'building-columns', 'graduation-cap', 'id-card',
  'sitemap', 'server', 'database', 'shield', 'clipboard', 'folder', 'file',
  'objects-column', 'megaphone',
  // shopping
  'shopping-cart', 'shopping-bag', 'shop', 'cart-plus', 'gift', 'ticket', 'box',
  'barcode', 'warehouse', 'qrcode',
  // home & transport
  'home', 'car', 'truck', 'map', 'map-marker', 'compass', 'directions',
  'bolt', 'wifi', 'lightbulb', 'cog', 'wave-pulse',
  // devices & communication
  'mobile', 'desktop', 'tablet', 'headphones', 'camera', 'phone', 'envelope',
  'microphone', 'video', 'image', 'at',
  // lifestyle & people
  'heart', 'heart-fill', 'apple', 'book', 'palette', 'star', 'star-fill',
  'trophy', 'users', 'user', 'face-smile', 'sparkles', 'crown', 'sun', 'moon',
  'bell', 'clock', 'stopwatch', 'calendar', 'joystick',
  // tools & misc
  'wrench', 'hammer', 'key', 'lock', 'thumbtack', 'flag', 'flag-fill', 'globe',
  'bookmark', 'bookmark-fill', 'inbox', 'history', 'bell-slash', 'ban'
];

const EMPTY_FORM: CategoryForm = {
  id: null,
  name: '',
  type: 'expense',
  color: '#3b82f6',
  icon: 'tag'
};

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, DialogModule, InputTextModule, IconComponent],
  templateUrl: './categories.page.html',
  styleUrl: './categories.page.scss'
})
export class CategoriesPage implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  categories: Category[] = [];
  readonly iconOptions = ICON_OPTIONS;

  dialogVisible = false;
  form: CategoryForm = { ...EMPTY_FORM };

  constructor(
    private readonly categoryService: CategoryService,
    private readonly confirmationService: ConfirmationService,
    private readonly messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.categoryService
      .getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe((categories) => {
        this.categories = [...categories].sort((a, b) => a.name.localeCompare(b.name));
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get incomeCategories(): Category[] {
    return this.categories.filter((cat) => cat.type === 'income');
  }

  get expenseCategories(): Category[] {
    return this.categories.filter((cat) => cat.type === 'expense');
  }

  openCreateDialog(type: CategoryType): void {
    this.form = { ...EMPTY_FORM, type };
    this.dialogVisible = true;
  }

  openEditDialog(category: Category): void {
    this.form = {
      id: category.id,
      name: category.name,
      type: category.type,
      color: category.color,
      icon: category.icon
    };
    this.dialogVisible = true;
  }

  async saveCategory(): Promise<void> {
    if (!this.form.name.trim()) {
      this.messageService.add({ severity: 'warn', summary: 'Falta el nombre', detail: 'Ingresá un nombre para la categoría' });
      return;
    }

    const payload = {
      name: this.form.name.trim(),
      type: this.form.type,
      color: this.form.color,
      icon: this.form.icon
    };

    if (this.form.id) {
      await lastValueFrom(this.categoryService.update(this.form.id, payload));
      this.messageService.add({ severity: 'success', summary: 'Categoría actualizada' });
    } else {
      await lastValueFrom(this.categoryService.create(payload));
      this.messageService.add({ severity: 'success', summary: 'Categoría creada' });
    }

    this.dialogVisible = false;
  }

  deleteCategory(category: Category): void {
    this.confirmationService.confirm({
      header: '¿Eliminar categoría?',
      message: `Se eliminará "${category.name}". Las transacciones existentes con esta categoría quedarán sin categoría asignada.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí',
      rejectLabel: 'No',
      accept: async () => {
        await lastValueFrom(this.categoryService.delete(category.id));
        this.messageService.add({ severity: 'success', summary: 'Categoría eliminada' });
      }
    });
  }
}
