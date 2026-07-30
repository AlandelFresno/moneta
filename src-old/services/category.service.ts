import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Category } from '../models';

@Injectable({
  providedIn: 'root'
})
export class CategoryService {
  private readonly STORAGE_KEY = 'budget_categories';
  private categoriesSubject = new BehaviorSubject<Category[]>([]);
  public categories$ = this.categoriesSubject.asObservable();

  constructor() {
    this.loadCategories();
  }

  private loadCategories(): void {
    const data = localStorage.getItem(this.STORAGE_KEY);
    if (data) {
      const categories = JSON.parse(data).map((cat: any) => ({
        ...cat,
        createdAt: new Date(cat.createdAt),
        updatedAt: new Date(cat.updatedAt),
        deletedAt: cat.deletedAt ? new Date(cat.deletedAt) : undefined
      })).filter((cat: any) => !cat.deletedAt);

      // Migrate old icon format (remove 'pi-' prefix if present)
      const migratedCategories = this.migrateIconFormat(categories);
      this.categoriesSubject.next(migratedCategories);

      // Save migrated data if changes were made
      if (JSON.stringify(categories) !== JSON.stringify(migratedCategories)) {
        console.log('🔄 [CategoryService] Migrating icon format for existing categories');
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(migratedCategories));
      }
    } else {
      this.initializeDefaultCategories();
    }
  }

  private migrateIconFormat(categories: Category[]): Category[] {
    return categories.map(cat => {
      // If icon starts with 'pi-', remove it
      if (cat.icon.startsWith('pi-')) {
        return {
          ...cat,
          icon: cat.icon.substring(3) // Remove 'pi-' prefix
        };
      }
      return cat;
    });
  }

  private saveCategories(categories: Category[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(categories));
    this.categoriesSubject.next(categories);
  }

  private initializeDefaultCategories(): void {
    const defaultCategories: Category[] = [
      // Income categories
      { id: this.generateId(), name: 'Salary', type: 'income', color: '#10b981', icon: 'briefcase', createdAt: new Date(), updatedAt: new Date() },
      { id: this.generateId(), name: 'Freelance', type: 'income', color: '#3b82f6', icon: 'desktop', createdAt: new Date(), updatedAt: new Date() },
      { id: this.generateId(), name: 'Investment', type: 'income', color: '#8b5cf6', icon: 'chart-line', createdAt: new Date(), updatedAt: new Date() },
      { id: this.generateId(), name: 'Gift', type: 'income', color: '#ec4899', icon: 'gift', createdAt: new Date(), updatedAt: new Date() },

      // Expense categories
      { id: this.generateId(), name: 'Food & Dining', type: 'expense', color: '#f59e0b', icon: 'shopping-cart', createdAt: new Date(), updatedAt: new Date() },
      { id: this.generateId(), name: 'Transportation', type: 'expense', color: '#6366f1', icon: 'car', createdAt: new Date(), updatedAt: new Date() },
      { id: this.generateId(), name: 'Shopping', type: 'expense', color: '#ec4899', icon: 'shopping-bag', createdAt: new Date(), updatedAt: new Date() },
      { id: this.generateId(), name: 'Entertainment', type: 'expense', color: '#8b5cf6', icon: 'video', createdAt: new Date(), updatedAt: new Date() },
      { id: this.generateId(), name: 'Bills & Utilities', type: 'expense', color: '#ef4444', icon: 'file', createdAt: new Date(), updatedAt: new Date() },
      { id: this.generateId(), name: 'Health', type: 'expense', color: '#14b8a6', icon: 'heart', createdAt: new Date(), updatedAt: new Date() },
      { id: this.generateId(), name: 'Education', type: 'expense', color: '#06b6d4', icon: 'book', createdAt: new Date(), updatedAt: new Date() },
      { id: this.generateId(), name: 'Other', type: 'expense', color: '#64748b', icon: 'list', createdAt: new Date(), updatedAt: new Date() }
    ];
    this.saveCategories(defaultCategories);
  }

  getCategories(): Category[] {
    return this.categoriesSubject.value;
  }

  getCategoryById(id: string): Category | undefined {
    return this.categoriesSubject.value.find(cat => cat.id === id);
  }

  getCategoriesByType(type: 'income' | 'expense'): Category[] {
    return this.categoriesSubject.value.filter(cat => cat.type === type);
  }

  createCategory(category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Category {
    const newCategory: Category = {
      ...category,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const categories = [...this.categoriesSubject.value, newCategory];
    this.saveCategories(categories);
    return newCategory;
  }

  updateCategory(id: string, updates: Partial<Category>): void {
    const categories = this.categoriesSubject.value.map(cat =>
      cat.id === id
        ? { ...cat, ...updates, updatedAt: new Date() }
        : cat
    );
    this.saveCategories(categories);
  }

  deleteCategory(id: string): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    const all = stored ? JSON.parse(stored) : [];
    const updated = all.map((cat: any) =>
      cat.id === id ? { ...cat, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : cat
    );
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
    this.categoriesSubject.next(this.categoriesSubject.value.filter(cat => cat.id !== id));
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
