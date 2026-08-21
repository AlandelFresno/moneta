import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MessageService } from 'primeng/api';
import { BudgetAlertService } from './budget-alert.service';
import { BudgetService } from './budget.service';
import { TransactionService } from './transaction.service';
import { CategoryService } from './category.service';
import { Category } from '../core/types/category.types';

describe('BudgetAlertService', () => {
  let budgetService: BudgetService;
  let transactionService: TransactionService;
  let categoryService: CategoryService;
  let messageService: { add: jasmine.Spy };

  beforeEach(() => {
    localStorage.clear();
    messageService = { add: jasmine.createSpy('add') };
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), { provide: MessageService, useValue: messageService }]
    });
    budgetService = TestBed.inject(BudgetService);
    transactionService = TestBed.inject(TransactionService);
    categoryService = TestBed.inject(CategoryService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  async function makeCategory(): Promise<Category> {
    return firstValueFrom(categoryService.create({ name: 'Comida', type: 'expense', color: '#f00', icon: 'tag' }));
  }

  // totalAmount (2000) intentionally exceeds the single category's allocation (1000) so
  // spending inside that category can cross its own threshold without also crossing the
  // total-budget threshold — keeps each assertion isolated to a single alert.

  it('fires a warn toast once spending crosses 80% of a category allocation', async () => {
    const category = await makeCategory();
    const now = new Date();
    await firstValueFrom(budgetService.save(now, 2000, [{ categoryId: category.id, amount: 1000 }]));

    TestBed.inject(BudgetAlertService);
    await firstValueFrom(
      transactionService.create({ categoryId: category.id, type: 'expense', name: 'Super', description: '', amount: 850, date: now })
    );

    expect(messageService.add).toHaveBeenCalledTimes(1);
    expect(messageService.add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'warn', summary: 'Cerca del límite' }));
  });

  it('fires an error toast, not a warn, once spending reaches 100%', async () => {
    const category = await makeCategory();
    const now = new Date();
    await firstValueFrom(budgetService.save(now, 2000, [{ categoryId: category.id, amount: 1000 }]));

    TestBed.inject(BudgetAlertService);
    await firstValueFrom(
      transactionService.create({ categoryId: category.id, type: 'expense', name: 'Super', description: '', amount: 1200, date: now })
    );

    expect(messageService.add).toHaveBeenCalledTimes(1);
    expect(messageService.add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error', summary: 'Presupuesto superado' }));
  });

  it('does not re-fire the same threshold on a later unrelated emission', async () => {
    const category = await makeCategory();
    const now = new Date();
    await firstValueFrom(budgetService.save(now, 2000, [{ categoryId: category.id, amount: 1000 }]));

    TestBed.inject(BudgetAlertService);
    await firstValueFrom(
      transactionService.create({ categoryId: category.id, type: 'expense', name: 'Super', description: '', amount: 850, date: now })
    );
    expect(messageService.add).toHaveBeenCalledTimes(1);

    await firstValueFrom(
      transactionService.create({ categoryId: category.id, type: 'expense', name: 'Kiosco', description: '', amount: 10, date: now })
    );
    expect(messageService.add).toHaveBeenCalledTimes(1);
  });

  it('fires again for a new budget record even at the same threshold', async () => {
    const category = await makeCategory();
    const now = new Date();
    const budget = await firstValueFrom(budgetService.save(now, 2000, [{ categoryId: category.id, amount: 1000 }]));

    TestBed.inject(BudgetAlertService);
    await firstValueFrom(
      transactionService.create({ categoryId: category.id, type: 'expense', name: 'Super', description: '', amount: 850, date: now })
    );
    expect(messageService.add).toHaveBeenCalledTimes(1);

    await firstValueFrom(budgetService.delete(budget.id));
    await firstValueFrom(budgetService.save(now, 2000, [{ categoryId: category.id, amount: 1000 }]));

    expect(messageService.add).toHaveBeenCalledTimes(2);
  });
});
