import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { CsvService } from './csv.service';
import { Category } from '../core/types/category.types';
import { Transaction } from '../core/types/transaction.types';
import { Bill } from '../core/types/bill.types';

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

  describe('parseTransactions', () => {
    it('parses valid rows into transactions matched by category name', () => {
      const lines = [
        'Date,Type,Category,Name,Amount,Description',
        '2026-01-15,expense,Almacén,Supermercado,100,"Compra semanal"'
      ];

      const result = service.parseTransactions(lines, CATEGORIES, []);

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].transaction.categoryId).toBe('cat-1');
      expect(result.rows[0].transaction.name).toBe('Supermercado');
      expect(result.rows[0].transaction.amount).toBe(100);
      expect(result.rows[0].transaction.description).toBe('Compra semanal');
      expect(result.rows[0].isDuplicate).toBeFalse();
    });

    it('skips rows with an unknown category and reports the count', () => {
      const lines = ['Date,Type,Category,Name,Amount,Description', '2026-01-15,expense,NoExiste,Algo,50,""'];

      const result = service.parseTransactions(lines, CATEGORIES, []);

      expect(result.rows.length).toBe(0);
      expect(result.skippedUnknownCategory).toBe(1);
    });

    it('flags a row as duplicate when date+name+amount match an existing transaction', () => {
      const existing: Transaction[] = [
        {
          id: 't1',
          categoryId: 'cat-1',
          type: 'expense',
          name: 'Supermercado',
          description: '',
          amount: 100,
          date: new Date(2026, 0, 15),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const lines = ['Date,Type,Category,Name,Amount,Description', '2026-01-15,expense,Almacén,Supermercado,100,""'];

      const result = service.parseTransactions(lines, CATEGORIES, existing);

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].isDuplicate).toBeTrue();
    });

    it('does not flag as duplicate when amount differs', () => {
      const existing: Transaction[] = [
        {
          id: 't1',
          categoryId: 'cat-1',
          type: 'expense',
          name: 'Supermercado',
          description: '',
          amount: 100,
          date: new Date(2026, 0, 15),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const lines = ['Date,Type,Category,Name,Amount,Description', '2026-01-15,expense,Almacén,Supermercado,999,""'];

      const result = service.parseTransactions(lines, CATEGORIES, existing);

      expect(result.rows[0].isDuplicate).toBeFalse();
    });

    it('throws when the file has no transactions header', () => {
      const lines = ['not,a,valid,header'];

      expect(() => service.parseTransactions(lines, CATEGORIES, [])).toThrow();
    });

    it('reads transactions after a categories section', () => {
      const lines = [
        'Name,Type,Color,Icon',
        'Almacén,expense,#f00,tag',
        '',
        'Date,Type,Category,Name,Amount,Description',
        '2026-01-15,expense,Almacén,Supermercado,100,""'
      ];

      const result = service.parseTransactions(lines, CATEGORIES, []);

      expect(result.rows.length).toBe(1);
    });
  });

  describe('parseNewCategories', () => {
    it('returns categories from the file that do not already exist locally', () => {
      const lines = [
        'Name,Type,Color,Icon',
        'Almacén,expense,#f00,tag',
        'Ocio,expense,#00f,star',
        '',
        'Date,Type,Category,Name,Amount,Description'
      ];

      const result = service.parseNewCategories(lines, CATEGORIES);

      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Ocio');
      expect(result[0].type).toBe('expense');
      expect(result[0].color).toBe('#00f');
      expect(result[0].icon).toBe('star');
    });

    it('returns an empty array when the file has no categories section', () => {
      const lines = ['Date,Type,Category,Name,Amount,Description', '2026-01-15,expense,Almacén,Supermercado,100,""'];

      const result = service.parseNewCategories(lines, CATEGORIES);

      expect(result).toEqual([]);
    });

    it('deduplicates repeated category names within the file itself', () => {
      const lines = ['Name,Type,Color,Icon', 'Ocio,expense,#00f,star', 'Ocio,expense,#00f,star', ''];

      const result = service.parseNewCategories(lines, CATEGORIES);

      expect(result.length).toBe(1);
    });
  });

  describe('parseNewBills', () => {
    it('parses new bills matched by category name, skipping ones that already exist', () => {
      const lines = [
        'Name,Description,Category,ApproxAmount,Period,DueDate,Active',
        'Netflix,Streaming,Almacén,5000,monthly,2026-01-10,true',
        'Internet,,Almacén,8000,monthly,2026-01-05,true',
        '',
        'Date,Type,Category,Name,Amount,Description'
      ];

      const existing: Bill[] = [
        {
          id: 'b1',
          name: 'Internet',
          description: '',
          categoryId: 'cat-1',
          approxAmount: 8000,
          period: 'monthly',
          dueDate: new Date(2026, 0, 5),
          active: true,
          payments: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const result = service.parseNewBills(lines, CATEGORIES, existing);

      expect(result.bills.length).toBe(1);
      expect(result.bills[0].name).toBe('Netflix');
      expect(result.bills[0].categoryId).toBe('cat-1');
      expect(result.bills[0].period).toBe('monthly');
      expect(result.bills[0].active).toBeTrue();
      expect(result.skippedUnknownCategory).toBe(0);
    });

    it('skips bills whose category is unknown and reports the count', () => {
      const lines = ['Name,Description,Category,ApproxAmount,Period,DueDate,Active', 'Gimnasio,,NoExiste,3000,monthly,2026-01-01,true'];

      const result = service.parseNewBills(lines, CATEGORIES, []);

      expect(result.bills.length).toBe(0);
      expect(result.skippedUnknownCategory).toBe(1);
    });

    it('returns an empty result when the file has no bills section', () => {
      const lines = ['Date,Type,Category,Name,Amount,Description'];

      const result = service.parseNewBills(lines, CATEGORIES, []);

      expect(result.bills).toEqual([]);
      expect(result.skippedUnknownCategory).toBe(0);
    });
  });

  describe('parseNewCategories with a bills section present', () => {
    it('stops the categories section at the bills header, not at end of file', () => {
      const lines = [
        'Name,Type,Color,Icon',
        'Ocio,expense,#00f,star',
        '',
        'Name,Description,Category,ApproxAmount,Period,DueDate,Active',
        'Netflix,,Almacén,5000,monthly,2026-01-10,true',
        '',
        'Date,Type,Category,Name,Amount,Description'
      ];

      const result = service.parseNewCategories(lines, CATEGORIES);

      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Ocio');
    });
  });

  describe('readCsvSections', () => {
    it('splits a file into lines, stripping trailing carriage returns', async () => {
      const file = makeFile('a,b\r\nc,d\r\n');

      const lines = await service.readCsvSections(file);

      expect(lines).toEqual(['a,b', 'c,d', '']);
    });
  });
});
