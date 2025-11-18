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
    // General
    'tag', 'tags', 'star', 'flag', 'bookmark', 'check', 'times',
    // Trabajo e ingresos
    'briefcase', 'desktop', 'chart-line', 'building', 'users', 'user',
    // Compras y consumo
    'shopping-cart', 'shopping-bag', 'gift', 'ticket', 'box',
    // Transporte
    'car', 'map', 'compass', 'send', 'map-marker',
    // Hogar
    'home', 'key', 'wrench', 'bolt', 'lightbulb', 'power-off',
    // Comida y bebida
    'coffee', 'glass-martini',
    // Entretenimiento
    'video', 'camera', 'music', 'tv', 'palette', 'images', 'image',
    // Salud y bienestar
    'heart', 'moon', 'sun', 'heart-fill',
    // Educación y cultura
    'book', 'pencil', 'pen',
    // Tecnología y servicios
    'mobile', 'tablet', 'phone', 'wifi', 'cloud', 'database', 'server',
    // Finanzas
    'credit-card', 'dollar', 'wallet', 'percentage', 'chart-bar', 'chart-pie',
    // Utilidades y documentos
    'file', 'folder', 'calendar', 'clock', 'bell', 'inbox', 'envelope',
    // Seguros y protección
    'shield', 'lock', 'unlock', 'eye', 'eye-slash',
    // Otros
    'globe', 'truck', 'cog', 'sliders', 'sitemap', 'th', 'bars'
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
