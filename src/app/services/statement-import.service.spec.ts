import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { StatementImportService } from './statement-import.service';
import { TransactionService } from './transaction.service';
import { BillService } from './bill.service';
import { Transaction } from '../core/types/transaction.types';
import { Bill } from '../core/types/bill.types';
import { ParsedStatementRow, StatementParseResult } from '../core/types/statement-import.types';

const MERCADOPAGO_HEADER =
  'SOURCE_ID;PAYMENT_METHOD_TYPE;TRANSACTION_TYPE;TRANSACTION_AMOUNT;TRANSACTION_DATE;FEE_AMOUNT;SETTLEMENT_DATE;REAL_AMOUNT;TAXES_AMOUNT;BUSINESS_UNIT;SUB_UNIT;MONEY_RELEASE_DATE';

function makeFile(name: string, content: string): File {
  return new File([content], name, { type: 'text/csv' });
}

function txn(overrides: Partial<Transaction> & { id: string; date: Date; categoryId: string }): Transaction {
  return {
    type: 'expense',
    name: 'Supermercado',
    description: '',
    amount: 100,
    createdAt: overrides.date,
    updatedAt: overrides.date,
    ...overrides
  };
}

function bill(overrides: Partial<Bill> & { id: string }): Bill {
  const now = new Date(2026, 0, 1);
  return {
    name: 'Internet',
    description: '',
    categoryId: 'cat-services',
    approxAmount: 18000,
    period: 'monthly',
    dueDate: now,
    active: true,
    payments: [],
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function row(overrides: Partial<ParsedStatementRow> = {}): ParsedStatementRow {
  return {
    rowId: 'row-1',
    date: new Date(2026, 5, 15),
    name: 'Supermercado',
    description: '',
    amount: 100,
    type: 'expense',
    categoryId: 'cat-1',
    accountId: 'acc-1',
    isDuplicate: false,
    include: true,
    ...overrides
  };
}

describe('StatementImportService', () => {
  let service: StatementImportService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    service = TestBed.inject(StatementImportService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('parseFile', () => {
    it('dispatches a .csv file to the MercadoPago parser', async () => {
      const content = [MERCADOPAGO_HEADER, '1;available_money;SETTLEMENT;-100.00;2026-06-18T08:20:16.000-03:00;0;;-100;0;;;'].join('\n');

      const result = await service.parseFile(makeFile('export.csv', content));

      expect(result.source).toBe('mercadopago');
      expect(result.rows.length).toBe(1);
    });

    it('throws for an unsupported file extension', async () => {
      await expectAsync(service.parseFile(makeFile('notes.txt', 'hello'))).toBeRejected();
    });
  });

  describe('annotate', () => {
    it('sets the default account on every row', () => {
      const result: StatementParseResult = { source: 'mercadopago', rows: [row({ accountId: '', categoryId: '' })], errors: [] };

      const [annotated] = service.annotate(result, [], 'acc-default');

      expect(annotated.accountId).toBe('acc-default');
    });

    it('suggests a category from matching transaction history', () => {
      const history = [txn({ id: 't1', categoryId: 'cat-food', name: 'Supermercado', date: new Date(2026, 5, 1) })];
      const result: StatementParseResult = { source: 'mercadopago', rows: [row({ categoryId: '' })], errors: [] };

      const [annotated] = service.annotate(result, history, 'acc-1');

      expect(annotated.categoryId).toBe('cat-food');
      expect(annotated.suggestedCategoryId).toBe('cat-food');
    });

    it('flags a row as a duplicate and excludes it from `include` by default', () => {
      const history = [txn({ id: 't1', categoryId: 'cat-1', name: 'Supermercado', amount: 100, date: new Date(2026, 5, 15) })];
      const result: StatementParseResult = { source: 'mercadopago', rows: [row({ name: 'Supermercado', amount: 100, date: new Date(2026, 5, 15) })], errors: [] };

      const [annotated] = service.annotate(result, history, 'acc-1');

      expect(annotated.isDuplicate).toBeTrue();
      expect(annotated.include).toBeFalse();
    });

    it('pre-links a single matching active bill for an expense row', () => {
      // categoryId is derived from the suggested category, not the row's own — so the history
      // has to actually suggest 'cat-food' for this row's name before a bill can match on it.
      const history = [txn({ id: 't1', categoryId: 'cat-food', name: 'Supermercado', date: new Date(2026, 5, 1) })];
      const bills = [bill({ id: 'bill-1', categoryId: 'cat-food', approxAmount: 100 })];
      const result: StatementParseResult = { source: 'mercadopago', rows: [row({ categoryId: '', amount: 105, type: 'expense' })], errors: [] };

      const [annotated] = service.annotate(result, history, 'acc-1', bills);

      expect(annotated.categoryId).toBe('cat-food');
      expect(annotated.billId).toBe('bill-1');
    });

    it('does not link a bill for an income row', () => {
      const history = [txn({ id: 't1', categoryId: 'cat-food', name: 'Supermercado', date: new Date(2026, 5, 1) })];
      const bills = [bill({ id: 'bill-1', categoryId: 'cat-food', approxAmount: 100 })];
      const result: StatementParseResult = { source: 'mercadopago', rows: [row({ categoryId: '', amount: 100, type: 'income' })], errors: [] };

      const [annotated] = service.annotate(result, history, 'acc-1', bills);

      expect(annotated.billId).toBeUndefined();
    });
  });

  describe('commitOne', () => {
    it('creates a transaction and returns true', async () => {
      const created = await service.commitOne(row());

      expect(created).toBeTrue();
      const transactionService = TestBed.inject(TransactionService);
      const all = await firstValueFrom(transactionService.getAll());
      expect(all.length).toBe(1);
      expect(all[0].name).toBe('Supermercado');
    });

    it('returns false and creates nothing when categoryId is missing', async () => {
      const created = await service.commitOne(row({ categoryId: '' }));

      expect(created).toBeFalse();
      const transactionService = TestBed.inject(TransactionService);
      const all = await firstValueFrom(transactionService.getAll());
      expect(all.length).toBe(0);
    });

    it('creates a transaction with no account when accountId is empty', async () => {
      await service.commitOne(row({ accountId: '' }));

      const transactionService = TestBed.inject(TransactionService);
      const [created] = await firstValueFrom(transactionService.getAll());
      expect(created.accountId).toBeUndefined();
    });

    it('links the created transaction to the bill as a payment when billId is set', async () => {
      const billService = TestBed.inject(BillService);
      const createdBill = await firstValueFrom(
        billService.create({
          name: 'Internet',
          description: '',
          categoryId: 'cat-1',
          approxAmount: 18000,
          period: 'monthly',
          dueDate: new Date(2026, 0, 5),
          active: true
        })
      );

      await service.commitOne(row({ billId: createdBill.id, amount: 18000 }));

      const [billAfter] = await firstValueFrom(billService.getAll());
      expect(billAfter.payments.length).toBe(1);
      expect(billAfter.payments[0].amount).toBe(18000);
    });
  });

  describe('commit', () => {
    it('commits only included, categorized rows and returns the count created', async () => {
      const rows = [
        row({ rowId: 'r1', include: true, categoryId: 'cat-1' }),
        row({ rowId: 'r2', include: false, categoryId: 'cat-1' }),
        row({ rowId: 'r3', include: true, categoryId: '' })
      ];

      const count = await service.commit(rows);

      expect(count).toBe(1);
      const transactionService = TestBed.inject(TransactionService);
      const all = await firstValueFrom(transactionService.getAll());
      expect(all.length).toBe(1);
      expect(all[0].id).toBeDefined();
    });
  });
});
