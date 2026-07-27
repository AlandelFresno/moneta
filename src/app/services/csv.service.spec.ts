import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { CsvService } from './csv.service';
import { Category } from '../core/types/category.types';
import { Transaction } from '../core/types/transaction.types';

const CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Almacén', type: 'expense', color: '#f00', icon: 'tag', createdAt: new Date(), updatedAt: new Date() },
  { id: 'cat-2', name: 'Salario', type: 'income', color: '#0f0', icon: 'tag', createdAt: new Date(), updatedAt: new Date() }
];

function makeFile(content: string): File {
  return new File([content], 'transactions.csv', { type: 'text/csv' });
}

describe('CsvService', () => {
  let service: CsvService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    service = TestBed.inject(CsvService);
  });

  it('parses valid rows into transactions matched by category name', async () => {
    const csv = [
      'Date,Type,Category,Name,Amount,Description',
      '2026-01-15,expense,Almacén,Supermercado,100,"Compra semanal"'
    ].join('\n');

    const result = await service.parseTransactionsCsv(makeFile(csv), CATEGORIES, []);

    expect(result.rows.length).toBe(1);
    expect(result.rows[0].transaction.categoryId).toBe('cat-1');
    expect(result.rows[0].transaction.name).toBe('Supermercado');
    expect(result.rows[0].transaction.amount).toBe(100);
    expect(result.rows[0].transaction.description).toBe('Compra semanal');
    expect(result.rows[0].isDuplicate).toBeFalse();
  });

  it('skips rows with an unknown category and reports the count', async () => {
    const csv = [
      'Date,Type,Category,Name,Amount,Description',
      '2026-01-15,expense,NoExiste,Algo,50,""'
    ].join('\n');

    const result = await service.parseTransactionsCsv(makeFile(csv), CATEGORIES, []);

    expect(result.rows.length).toBe(0);
    expect(result.skippedUnknownCategory).toBe(1);
  });

  it('flags a row as duplicate when date+name+amount match an existing transaction', async () => {
    const existing: Transaction[] = [
      {
        id: 't1',
        categoryId: 'cat-1',
        type: 'expense',
        name: 'Supermercado',
        description: '',
        amount: 100,
        date: new Date('2026-01-15'),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    const csv = [
      'Date,Type,Category,Name,Amount,Description',
      '2026-01-15,expense,Almacén,Supermercado,100,""'
    ].join('\n');

    const result = await service.parseTransactionsCsv(makeFile(csv), CATEGORIES, existing);

    expect(result.rows.length).toBe(1);
    expect(result.rows[0].isDuplicate).toBeTrue();
  });

  it('does not flag as duplicate when amount differs', async () => {
    const existing: Transaction[] = [
      {
        id: 't1',
        categoryId: 'cat-1',
        type: 'expense',
        name: 'Supermercado',
        description: '',
        amount: 100,
        date: new Date('2026-01-15'),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    const csv = [
      'Date,Type,Category,Name,Amount,Description',
      '2026-01-15,expense,Almacén,Supermercado,999,""'
    ].join('\n');

    const result = await service.parseTransactionsCsv(makeFile(csv), CATEGORIES, existing);

    expect(result.rows[0].isDuplicate).toBeFalse();
  });

  it('throws when the file has no data rows', async () => {
    const csv = 'Date,Type,Category,Name,Amount,Description';

    await expectAsync(service.parseTransactionsCsv(makeFile(csv), CATEGORIES, [])).toBeRejected();
  });
});
