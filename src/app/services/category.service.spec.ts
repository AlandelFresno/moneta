import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CategoryService } from './category.service';
import { Category } from '../core/types/category.types';

describe('CategoryService', () => {
  let service: CategoryService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    service = TestBed.inject(CategoryService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('seeds two default categories on first run', async () => {
    const categories = await firstValueFrom(service.getAll());
    expect(categories.length).toBe(2);
    expect(categories.some((c) => c.name === 'Salario' && c.type === 'income')).toBeTrue();
    expect(categories.some((c) => c.name === 'Almacén' && c.type === 'expense')).toBeTrue();
  });

  it('does not reseed on a fresh service instance once data exists', async () => {
    await firstValueFrom(service.create({ name: 'Extra', type: 'expense', color: '#000', icon: 'tag' }));

    const fresh = new CategoryService();
    const categories = await firstValueFrom(fresh.getAll());
    expect(categories.length).toBe(3);
  });

  it('creates a category with generated id and timestamps', async () => {
    const created = await firstValueFrom(
      service.create({ name: 'Ocio', type: 'expense', color: '#f00', icon: 'star' })
    );

    expect(created.id).toBeTruthy();
    expect(created.name).toBe('Ocio');
    expect(created.createdAt).toEqual(jasmine.any(Date));
    expect(created.updatedAt).toEqual(jasmine.any(Date));

    const all = await firstValueFrom(service.getAll());
    expect(all.find((c) => c.id === created.id)).toBeTruthy();
  });

  it('filters categories by type', async () => {
    await firstValueFrom(service.create({ name: 'Freelance', type: 'income', color: '#0f0', icon: 'briefcase' }));

    const expenseOnly = await firstValueFrom(service.getByType('expense'));
    expect(expenseOnly.every((c) => c.type === 'expense')).toBeTrue();

    const incomeOnly = await firstValueFrom(service.getByType('income'));
    expect(incomeOnly.every((c) => c.type === 'income')).toBeTrue();
  });

  it('updates a category and bumps updatedAt', async () => {
    const created = await firstValueFrom(
      service.create({ name: 'Salud', type: 'expense', color: '#0ff', icon: 'heart' })
    );
    const originalUpdatedAt = created.updatedAt.getTime();

    await new Promise((resolve) => setTimeout(resolve, 5));
    await firstValueFrom(service.update(created.id, { name: 'Salud y Bienestar' }));

    const all = await firstValueFrom(service.getAll());
    const updated = all.find((c) => c.id === created.id)!;
    expect(updated.name).toBe('Salud y Bienestar');
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt);
  });

  it('soft-deletes a category, removing it from getAll but keeping it in storage', async () => {
    const created = await firstValueFrom(
      service.create({ name: 'Temporal', type: 'expense', color: '#333', icon: 'tag' })
    );

    await firstValueFrom(service.delete(created.id));

    const all = await firstValueFrom(service.getAll());
    expect(all.find((c) => c.id === created.id)).toBeUndefined();

    const raw = JSON.parse(localStorage.getItem('categories')!);
    const stored = raw.find((c: { id: string }) => c.id === created.id);
    expect(stored.deletedAt).toBeTruthy();
  });

  it('persists categories across service instances via localStorage', async () => {
    await firstValueFrom(service.create({ name: 'Persistente', type: 'income', color: '#111', icon: 'tag' }));

    const fresh = new CategoryService();
    const all = await firstValueFrom(fresh.getAll());
    expect(all.some((c) => c.name === 'Persistente')).toBeTrue();
  });

  it('seeds default categories with stable ids (so two fresh installs merge, not duplicate)', async () => {
    const categories = await firstValueFrom(service.getAll());
    const ids = categories.map((c) => c.id).sort();
    expect(ids).toEqual(['seed-expense-default', 'seed-income-default']);
  });

  it('keeps a soft-deleted tombstone in storage after a subsequent create (regression)', async () => {
    const created = await firstValueFrom(
      service.create({ name: 'Temporal', type: 'expense', color: '#333', icon: 'tag' })
    );
    await firstValueFrom(service.delete(created.id));

    await firstValueFrom(service.create({ name: 'Otra', type: 'expense', color: '#444', icon: 'tag' }));

    const raw = JSON.parse(localStorage.getItem('categories')!);
    const tombstone = raw.find((c: { id: string }) => c.id === created.id);
    expect(tombstone).toBeTruthy();
    expect(tombstone.deletedAt).toBeTruthy();
  });

  it('exposes tombstones via getAllIncludingDeleted but not via getAll', async () => {
    const created = await firstValueFrom(
      service.create({ name: 'Temporal', type: 'expense', color: '#333', icon: 'tag' })
    );
    await firstValueFrom(service.delete(created.id));

    const active = await firstValueFrom(service.getAll());
    expect(active.find((c) => c.id === created.id)).toBeUndefined();

    const all = service.getAllIncludingDeleted();
    const tombstone = all.find((c) => c.id === created.id);
    expect(tombstone?.deletedAt).toEqual(jasmine.any(Date));
  });

  it('replaceAll persists and emits exactly what is passed', async () => {
    const created = await firstValueFrom(
      service.create({ name: 'Original', type: 'expense', color: '#333', icon: 'tag' })
    );
    const replacement: Category = { ...created, name: 'Reemplazado' };

    service.replaceAll([replacement]);

    const all = await firstValueFrom(service.getAll());
    expect(all.length).toBe(1);
    expect(all[0].name).toBe('Reemplazado');

    const raw = JSON.parse(localStorage.getItem('categories')!);
    expect(raw.length).toBe(1);
    expect(raw[0].name).toBe('Reemplazado');
  });
});
