import { Injectable } from '@angular/core';
import { Transaction, Account, Category } from '../models';

@Injectable({
  providedIn: 'root'
})
export class CsvService {

  // Export transactions to CSV
  exportTransactionsToCsv(transactions: Transaction[], accounts: Account[], categories: Category[]): void {
    const headers = ['Date', 'Type', 'Account', 'Category', 'Amount', 'Currency', 'Description'];

    const rows = transactions.map(txn => {
      const account = accounts.find(acc => acc.id === txn.accountId);
      const category = categories.find(cat => cat.id === txn.categoryId);

      return [
        this.formatDate(txn.date),
        txn.type,
        account?.name || 'Unknown',
        category?.name || 'Unknown',
        txn.amount.toString(),
        txn.currency,
        `"${txn.description.replace(/"/g, '""')}"`
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    this.downloadCsv(csvContent, `transactions-${this.formatDate(new Date())}.csv`);
  }

  // Export accounts to CSV
  exportAccountsToCsv(accounts: Account[]): void {
    const headers = ['Name', 'Type', 'Balance', 'Currency', 'Color', 'Icon'];

    const rows = accounts.map(acc => [
      `"${acc.name.replace(/"/g, '""')}"`,
      acc.type,
      acc.balance.toString(),
      acc.currency,
      acc.color,
      acc.icon
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    this.downloadCsv(csvContent, `accounts-${this.formatDate(new Date())}.csv`);
  }

  // Export categories to CSV
  exportCategoriesToCsv(categories: Category[]): void {
    const headers = ['Name', 'Type', 'Color', 'Icon'];

    const rows = categories.map(cat => [
      `"${cat.name.replace(/"/g, '""')}"`,
      cat.type,
      cat.color,
      cat.icon
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    this.downloadCsv(csvContent, `categories-${this.formatDate(new Date())}.csv`);
  }

  // Import transactions from CSV
  async importTransactionsFromCsv(
    file: File,
    accounts: Account[],
    categories: Category[]
  ): Promise<Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>[]> {
    const text = await this.readFileAsText(file);
    const lines = text.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      throw new Error('CSV file is empty or invalid');
    }

    // Skip header
    const dataLines = lines.slice(1);
    const transactions: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>[] = [];

    for (const line of dataLines) {
      const values = this.parseCsvLine(line);

      if (values.length < 6) continue;

      const [dateStr, type, accountName, categoryName, amountStr, description] = values;

      // Find account
      const account = accounts.find(acc => acc.name === accountName);
      if (!account) {
        console.warn(`Account not found: ${accountName}`);
        continue;
      }

      // Find category
      const category = categories.find(cat => cat.name === categoryName);
      if (!category) {
        console.warn(`Category not found: ${categoryName}`);
        continue;
      }

      transactions.push({
        accountId: account.id,
        categoryId: category.id,
        type: type as 'income' | 'expense',
        amount: parseFloat(amountStr),
        currency: account.currency,
        description: description.replace(/^"|"$/g, '').replace(/""/g, '"'),
        date: new Date(dateStr)
      });
    }

    return transactions;
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
          i++; // Skip next quote
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

  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
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
  }

  private formatDate(date: Date): string {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
