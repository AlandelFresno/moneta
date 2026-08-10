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
import { CATEGORY_ICON_OPTIONS } from '../../core/utils/category-icons.util';

interface CategoryForm {
  id: string | null;
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
}

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
  readonly iconOptions = CATEGORY_ICON_OPTIONS;

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
