import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { Category, CategoryType } from '../core/types/category.types';

export interface StoredCategory extends Omit<Category, 'createdAt' | 'updatedAt' | 'deletedAt'> {
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export function toCategory(stored: StoredCategory): Category {
  return {
    ...stored,
    createdAt: new Date(stored.createdAt),
    updatedAt: new Date(stored.updatedAt),
    deletedAt: stored.deletedAt ? new Date(stored.deletedAt) : undefined
  };
}

export function fromCategory(cat: Category): StoredCategory {
  return {
    ...cat,
    createdAt: cat.createdAt.toISOString(),
    updatedAt: cat.updatedAt.toISOString(),
    deletedAt: cat.deletedAt ? cat.deletedAt.toISOString() : undefined
  };
}

@Injectable({
  providedIn: 'root'
})
export class CategoryService {
  private readonly storageKey = 'categories';
  private readonly allSubject = new BehaviorSubject<Category[]>(this.loadAll());
  readonly categories$: Observable<Category[]> = this.allSubject.pipe(
    map((categories) => categories.filter((cat) => !cat.deletedAt))
  );

  private loadAll(): Category[] {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      return this.seedDefaults();
    }

    const stored: StoredCategory[] = JSON.parse(raw);
    return stored.map((cat) => toCategory(cat));
  }

  private seedDefaults(): Category[] {
    const now = new Date();
    const defaults: Category[] = [
      { id: 'seed-income-default', name: 'Salario', type: 'income', color: '#10b981', icon: 'briefcase', createdAt: now, updatedAt: now },
      { id: 'seed-expense-default', name: 'Almacén', type: 'expense', color: '#f59e0b', icon: 'shopping-cart', createdAt: now, updatedAt: now }
    ];
    this.persist(defaults);
    return defaults;
  }

  private persist(categories: Category[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(categories.map((cat) => fromCategory(cat))));
  }

  getAll(): Observable<Category[]> {
    return this.categories$;
  }

  getAllIncludingDeleted(): Category[] {
    return this.allSubject.value;
  }

  replaceAll(categories: Category[]): void {
    this.persist(categories);
    this.allSubject.next(categories);
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

    const categories = [...this.allSubject.value, newCategory];
    this.persist(categories);
    this.allSubject.next(categories);

    return new Observable((subscriber) => {
      subscriber.next(newCategory);
      subscriber.complete();
    });
  }

  update(id: string, updates: Partial<Omit<Category, 'id' | 'createdAt'>>): Observable<void> {
    const categories = this.allSubject.value.map((cat) =>
      cat.id === id ? { ...cat, ...updates, updatedAt: new Date() } : cat
    );
    this.persist(categories);
    this.allSubject.next(categories);

    return new Observable((subscriber) => {
      subscriber.next();
      subscriber.complete();
    });
  }

  delete(id: string): Observable<void> {
    const now = new Date();
    const categories = this.allSubject.value.map((cat) =>
      cat.id === id ? { ...cat, deletedAt: now, updatedAt: now } : cat
    );
    this.persist(categories);
    this.allSubject.next(categories);

    return new Observable((subscriber) => {
      subscriber.next();
      subscriber.complete();
    });
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}
