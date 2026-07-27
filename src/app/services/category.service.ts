import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Category, CategoryType } from '../core/types/category.types';

interface StoredCategory extends Omit<Category, 'createdAt' | 'updatedAt' | 'deletedAt'> {
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CategoryService {
  private readonly storageKey = 'categories';
  private readonly categoriesSubject = new BehaviorSubject<Category[]>(this.loadFromStorage());
  readonly categories$: Observable<Category[]> = this.categoriesSubject.asObservable();

  private loadFromStorage(): Category[] {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      return this.seedDefaults();
    }

    const stored: StoredCategory[] = JSON.parse(raw);
    return stored
      .filter((cat) => !cat.deletedAt)
      .map((cat) => this.toCategory(cat));
  }

  private toCategory(stored: StoredCategory): Category {
    return {
      ...stored,
      createdAt: new Date(stored.createdAt),
      updatedAt: new Date(stored.updatedAt),
      deletedAt: stored.deletedAt ? new Date(stored.deletedAt) : undefined
    };
  }

  private seedDefaults(): Category[] {
    const now = new Date();
    const defaults: Category[] = [
      { id: this.generateId(), name: 'Salario', type: 'income', color: '#10b981', icon: 'briefcase', createdAt: now, updatedAt: now },
      { id: this.generateId(), name: 'Almacén', type: 'expense', color: '#f59e0b', icon: 'shopping-cart', createdAt: now, updatedAt: now }
    ];
    this.persist(defaults);
    return defaults;
  }

  private persist(categories: Category[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(categories));
  }

  getAll(): Observable<Category[]> {
    return this.categories$;
  }

  getByType(type: CategoryType): Observable<Category[]> {
    return new Observable((subscriber) => {
      return this.categories$.subscribe((categories) => {
        subscriber.next(categories.filter((cat) => cat.type === type));
      });
    });
  }

  create(category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Observable<Category> {
    const now = new Date();
    const newCategory: Category = {
      ...category,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now
    };

    const categories = [...this.categoriesSubject.value, newCategory];
    this.persist(categories);
    this.categoriesSubject.next(categories);

    return new Observable((subscriber) => {
      subscriber.next(newCategory);
      subscriber.complete();
    });
  }

  update(id: string, updates: Partial<Omit<Category, 'id' | 'createdAt'>>): Observable<void> {
    const categories = this.categoriesSubject.value.map((cat) =>
      cat.id === id ? { ...cat, ...updates, updatedAt: new Date() } : cat
    );
    this.persist(categories);
    this.categoriesSubject.next(categories);

    return new Observable((subscriber) => {
      subscriber.next();
      subscriber.complete();
    });
  }

  delete(id: string): Observable<void> {
    const raw = localStorage.getItem(this.storageKey);
    const stored: StoredCategory[] = raw ? JSON.parse(raw) : [];
    const now = new Date().toISOString();
    const updated = stored.map((cat) => (cat.id === id ? { ...cat, deletedAt: now, updatedAt: now } : cat));
    localStorage.setItem(this.storageKey, JSON.stringify(updated));
    this.categoriesSubject.next(this.categoriesSubject.value.filter((cat) => cat.id !== id));

    return new Observable((subscriber) => {
      subscriber.next();
      subscriber.complete();
    });
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}
