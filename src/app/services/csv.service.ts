import { Injectable } from '@angular/core';
import { Transaction, TransactionType } from '../core/types/transaction.types';
import { Category, CategoryType } from '../core/types/category.types';

export interface ParsedCsvRow {
  transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>;
  isDuplicate: boolean;
}

export interface CsvImportResult {
  rows: ParsedCsvRow[];
  skippedUnknownCategory: number;
}

const TRANSACTIONS_HEADER = 'Date,Type,Category,Name,Amount,Description';
const CATEGORIES_HEADER = 'Name,Type,Color,Icon';

@Injectable({
  providedIn: 'root'
})
export class CsvService {
  async readCsvSections(file: File): Promise<string[]> {
    const text = await this.readFileAsText(file);
    return text.split('\n').map((line) => line.replace(/\r$/, ''));
  }

  parseNewCategories(lines: string[], existing: Category[]): Omit<Category, 'id' | 'createdAt' | 'updatedAt'>[] {
    const categoriesStart = lines.findIndex((line) => line.trim() === CATEGORIES_HEADER);
    if (categoriesStart === -1) return [];

    const transactionsStart = lines.findIndex((line) => line.trim() === TRANSACTIONS_HEADER);
    const sectionEnd = transactionsStart === -1 ? lines.length : transactionsStart;

    const result: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>[] = [];

    for (const line of lines.slice(categoriesStart + 1, sectionEnd)) {
      if (!line.trim()) continue;
      const values = this.parseCsvLine(line);
      if (values.length < 4) continue;

      const [name, type, color, icon] = values;
      const unescapedName = this.unescapeCsv(name);

      if (existing.some((cat) => cat.name === unescapedName)) continue;
      if (result.some((cat) => cat.name === unescapedName)) continue;

      result.push({
        name: unescapedName,
        type: type.trim() as CategoryType,
        color: color.trim(),
        icon: icon.trim()
      });
    }

    return result;
  }

  parseTransactions(lines: string[], categories: Category[], existing: Transaction[]): CsvImportResult {
    const transactionsStart = lines.findIndex((line) => line.trim() === TRANSACTIONS_HEADER);
    if (transactionsStart === -1) {
      throw new Error('El archivo CSV está vacío o no tiene el formato esperado.');
    }

    const transactionLines = lines.slice(transactionsStart + 1).filter((line) => line.trim());
    const rows: ParsedCsvRow[] = [];
    let skippedUnknownCategory = 0;

    for (const line of transactionLines) {
      const values = this.parseCsvLine(line);
      if (values.length < 6) continue;

      const [dateStr, type, categoryName, name, amountStr, description] = values;

      const category = categories.find((cat) => cat.name === this.unescapeCsv(categoryName));
      if (!category) {
        skippedUnknownCategory++;
        continue;
      }

      const transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> = {
        categoryId: category.id,
        type: type.trim() as TransactionType,
        name: this.unescapeCsv(name),
        description: this.unescapeCsv(description),
        amount: parseFloat(amountStr),
        date: this.parseLocalDate(dateStr)
      };

      rows.push({
        transaction,
        isDuplicate: this.isDuplicate(transaction, existing)
      });
    }

    return { rows, skippedUnknownCategory };
  }

  private isDuplicate(candidate: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>, existing: Transaction[]): boolean {
    return existing.some(
      (txn) =>
        txn.name === candidate.name &&
        txn.amount === candidate.amount &&
        this.isSameDay(txn.date, candidate.date)
    );
  }

  private isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  private parseLocalDate(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current);
    return values;
  }

  private unescapeCsv(value: string): string {
    return value.replace(/^"|"$/g, '').replace(/""/g, '"');
  }

  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  exportTransactionsToCsv(transactions: Transaction[], categories: Category[]): void {
    const categoryRows = categories.map((cat) => [this.escapeCsv(cat.name), cat.type, cat.color, cat.icon]);

    const transactionRows = transactions.map((txn) => {
      const category = categories.find((cat) => cat.id === txn.categoryId);

      return [
        this.formatDate(txn.date),
        txn.type,
        this.escapeCsv(category?.name ?? 'Sin categoría'),
        this.escapeCsv(txn.name),
        txn.amount.toString(),
        this.escapeCsv(txn.description)
      ];
    });

    const csvContent = [
      CATEGORIES_HEADER,
      ...categoryRows.map((row) => row.join(',')),
      '',
      TRANSACTIONS_HEADER,
      ...transactionRows.map((row) => row.join(','))
    ].join('\n');

    this.downloadCsv(csvContent, `transactions-${this.formatDate(new Date())}.csv`);
  }

  private escapeCsv(value: string): string {
    return `"${value.replace(/"/g, '""')}"`;
  }

  private downloadCsv(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
