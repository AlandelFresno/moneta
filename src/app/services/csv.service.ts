import { Injectable } from '@angular/core';
import { Transaction, TransactionType } from '../core/types/transaction.types';
import { Category } from '../core/types/category.types';

export interface ParsedCsvRow {
  transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>;
  isDuplicate: boolean;
}

export interface CsvImportResult {
  rows: ParsedCsvRow[];
  skippedUnknownCategory: number;
}

@Injectable({
  providedIn: 'root'
})
export class CsvService {
  async parseTransactionsCsv(file: File, categories: Category[], existing: Transaction[]): Promise<CsvImportResult> {
    const text = await this.readFileAsText(file);
    const lines = text.split('\n').filter((line) => line.trim());

    if (lines.length < 2) {
      throw new Error('El archivo CSV está vacío o no tiene el formato esperado.');
    }

    const dataLines = lines.slice(1);
    const rows: ParsedCsvRow[] = [];
    let skippedUnknownCategory = 0;

    for (const line of dataLines) {
      const values = this.parseCsvLine(line);
      if (values.length < 6) continue;

      const [dateStr, type, categoryName, name, amountStr, description] = values;

      const category = categories.find((cat) => cat.name === categoryName);
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
        date: new Date(dateStr)
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
    const headers = ['Date', 'Type', 'Category', 'Name', 'Amount', 'Description'];

    const rows = transactions.map((txn) => {
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

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

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
