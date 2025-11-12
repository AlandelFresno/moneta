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
        updatedAt: new Date(cat.updatedAt)
      }));
      this.categoriesSubject.next(categories);
    } else {
      this.initializeDefaultCategories();
    }
  }

  private saveCategories(categories: Category[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(categories));
    this.categoriesSubject.next(categories);
  }

  private initializeDefaultCategories(): void {
    const defaultCategories: Category[] = [
      // Income categories
      { id: this.generateId(), name: 'Salary', type: 'income', color: '#10b981', icon: 'pi-briefcase', createdAt: new Date(), updatedAt: new Date() },
      { id: this.generateId(), name: 'Freelance', type: 'income', color: '#3b82f6', icon: 'pi-desktop', createdAt: new Date(), updatedAt: new Date() },
      { id: this.generateId(), name: 'Investment', type: 'income', color: '#8b5cf6', icon: 'pi-chart-line', createdAt: new Date(), updatedAt: new Date() },
      { id: this.generateId(), name: 'Gift', type: 'income', color: '#ec4899', icon: 'pi-gift', createdAt: new Date(), updatedAt: new Date() },

      // Expense categories
      { id: this.generateId(), name: 'Food & Dining', type: 'expense', color: '#f59e0b', icon: 'pi-shopping-cart', createdAt: new Date(), updatedAt: new Date() },
      { id: this.generateId(), name: 'Transportation', type: 'expense', color: '#6366f1', icon: 'pi-car', createdAt: new Date(), updatedAt: new Date() },
      { id: this.generateId(), name: 'Shopping', type: 'expense', color: '#ec4899', icon: 'pi-shopping-bag', createdAt: new Date(), updatedAt: new Date() },
      { id: this.generateId(), name: 'Entertainment', type: 'expense', color: '#8b5cf6', icon: 'pi-video', createdAt: new Date(), updatedAt: new Date() },
      { id: this.generateId(), name: 'Bills & Utilities', type: 'expense', color: '#ef4444', icon: 'pi-file', createdAt: new Date(), updatedAt: new Date() },
      { id: this.generateId(), name: 'Health', type: 'expense', color: '#14b8a6', icon: 'pi-heart', createdAt: new Date(), updatedAt: new Date() },
      { id: this.generateId(), name: 'Education', type: 'expense', color: '#06b6d4', icon: 'pi-book', createdAt: new Date(), updatedAt: new Date() },
      { id: this.generateId(), name: 'Other', type: 'expense', color: '#64748b', icon: 'pi-list', createdAt: new Date(), updatedAt: new Date() }
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
    const categories = this.categoriesSubject.value.filter(cat => cat.id !== id);
    this.saveCategories(categories);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
