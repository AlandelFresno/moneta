import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { Category } from '../../models';
import { CategoryService } from '../../services/category.service';
import { CsvService } from '../../services/csv.service';

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
    'tag', 'tags', 'briefcase', 'desktop', 'chart-line', 'gift',
    'shopping-cart', 'car', 'shopping-bag', 'video', 'file-invoice',
    'medkit', 'book', 'home', 'plane', 'coffee', 'utensils', 'bus',
    'credit-card', 'money-bill', 'piggy-bank', 'wallet'
  ];

  constructor(
    private categoryService: CategoryService,
    private csvService: CsvService
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

  deleteCategory(category: Category): void {
    if (confirm(`Are you sure you want to delete "${category.name}"?`)) {
      this.categoryService.deleteCategory(category.id);
    }
  }

  exportToCSV(): void {
    this.csvService.exportCategoriesToCsv(this.categories);
  }
}
