import { Injectable } from '@angular/core';
import type jsPDF from 'jspdf';

import { Transaction } from '../core/types/transaction.types';
import { Category } from '../core/types/category.types';
import { CategoryBreakdownEntry, DateRange, PeriodComparison, PeriodStats } from './dashboard.service';

export interface MonthlyReportData {
  range: DateRange;
  stats: PeriodStats;
  comparison: PeriodComparison;
  expenseBreakdown: CategoryBreakdownEntry[];
  incomeBreakdown: CategoryBreakdownEntry[];
  topTransactions: Transaction[];
  categories: Category[];
  trendChartImage: string | null;
}

const PAGE_MARGIN = 14;
const PAGE_HEIGHT = 297;
const PAGE_WIDTH = 210;

@Injectable({
  providedIn: 'root'
})
export class ReportExportService {
  private readonly currencyFormatter = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  private readonly dateFormatter = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });

  async exportMonthlyReport(data: MonthlyReportData): Promise<void> {
    const { default: JsPDF } = await import('jspdf');
    const doc = new JsPDF({ unit: 'mm', format: 'a4' });
    let y = PAGE_MARGIN;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Moneta — Reporte financiero', PAGE_MARGIN, y);
    y += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(110);
    doc.text(`${this.formatDate(data.range.start)} – ${this.formatDate(data.range.end)}`, PAGE_MARGIN, y);
    doc.text(`Generado el ${this.formatDate(new Date())}`, PAGE_WIDTH - PAGE_MARGIN, y, { align: 'right' });
    doc.setTextColor(20);
    y += 9;

    y = this.addSummarySection(doc, data, y);

    if (data.trendChartImage) {
      y = this.ensureSpace(doc, y, 70);
      const imgWidth = PAGE_WIDTH - PAGE_MARGIN * 2;
      doc.addImage(data.trendChartImage, 'PNG', PAGE_MARGIN, y, imgWidth, 60);
      y += 68;
    }

    y = this.addBreakdownSection(doc, y, 'Gastos por categoría', data.expenseBreakdown, data.stats.expense);
    y = this.addBreakdownSection(doc, y, 'Ingresos por categoría', data.incomeBreakdown, data.stats.income);
    y = this.addTransactionsSection(doc, y, data.topTransactions, data.categories);

    doc.save(`reporte-${this.fileDate(data.range.start)}-a-${this.fileDate(data.range.end)}.pdf`);
  }

  private addSummarySection(doc: jsPDF, data: MonthlyReportData, startY: number): number {
    let y = startY;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumen', PAGE_MARGIN, y);
    y += 6;

    const rows: [string, string, number | null][] = [
      ['Ingresos', this.formatCurrency(data.stats.income), data.comparison.incomeChangePct],
      ['Gastos', this.formatCurrency(data.stats.expense), data.comparison.expenseChangePct],
      ['Balance', this.formatCurrency(data.stats.balance), data.comparison.balanceChangePct],
      ['Ahorro', data.stats.savingsRate === null ? '—' : `${data.stats.savingsRate.toFixed(1)}%`, null],
      ['Transacciones', `${data.stats.transactionCount}`, null],
      ['Monto promedio', this.formatCurrency(data.stats.avgTransaction), null]
    ];

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const colWidth = (PAGE_WIDTH - PAGE_MARGIN * 2) / 2;
    const rowHeight = 13;
    rows.forEach(([label, value, pct], i) => {
      const col = i % 2;
      const rowY = y + Math.floor(i / 2) * rowHeight;
      const x = PAGE_MARGIN + col * colWidth;
      doc.setTextColor(110);
      doc.text(label, x, rowY);
      doc.setTextColor(20);
      const pctText = pct === null ? '' : `  (${pct > 0 ? '+' : ''}${pct.toFixed(1)}%)`;
      doc.text(`${value}${pctText}`, x, rowY + 5);
    });

    return y + Math.ceil(rows.length / 2) * rowHeight;
  }

  private addBreakdownSection(
    doc: jsPDF,
    startY: number,
    title: string,
    entries: CategoryBreakdownEntry[],
    total: number
  ): number {
    if (entries.length === 0) return startY;

    let y = this.ensureSpace(doc, startY, 16 + entries.length * 6);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(title, PAGE_MARGIN, y);
    y += 7;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(110);
    doc.text('Categoría', PAGE_MARGIN, y);
    doc.text('Monto', PAGE_MARGIN + 100, y, { align: 'left' });
    doc.text('%', PAGE_WIDTH - PAGE_MARGIN, y, { align: 'right' });
    y += 5;
    doc.setDrawColor(220);
    doc.line(PAGE_MARGIN, y - 3, PAGE_WIDTH - PAGE_MARGIN, y - 3);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20);
    for (const entry of entries) {
      y = this.ensureSpace(doc, y, 6);
      doc.text(entry.categoryName, PAGE_MARGIN, y);
      doc.text(this.formatCurrency(entry.total), PAGE_MARGIN + 100, y);
      const pct = total > 0 ? (entry.total / total) * 100 : 0;
      doc.text(`${pct.toFixed(1)}%`, PAGE_WIDTH - PAGE_MARGIN, y, { align: 'right' });
      y += 6;
    }

    return y + 6;
  }

  private addTransactionsSection(doc: jsPDF, startY: number, transactions: Transaction[], categories: Category[]): number {
    if (transactions.length === 0) return startY;

    let y = this.ensureSpace(doc, startY, 16 + transactions.length * 6);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Mayores transacciones', PAGE_MARGIN, y);
    y += 7;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(110);
    doc.text('Fecha', PAGE_MARGIN, y);
    doc.text('Nombre', PAGE_MARGIN + 25, y);
    doc.text('Categoría', PAGE_MARGIN + 100, y);
    doc.text('Monto', PAGE_WIDTH - PAGE_MARGIN, y, { align: 'right' });
    y += 5;
    doc.setDrawColor(220);
    doc.line(PAGE_MARGIN, y - 3, PAGE_WIDTH - PAGE_MARGIN, y - 3);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20);
    for (const txn of transactions) {
      y = this.ensureSpace(doc, y, 6);
      const category = categories.find((cat) => cat.id === txn.categoryId);
      doc.text(this.formatShortDate(txn.date), PAGE_MARGIN, y);
      doc.text(this.truncate(txn.name, 40), PAGE_MARGIN + 25, y);
      doc.text(this.truncate(category?.name ?? 'Sin categoría', 20), PAGE_MARGIN + 100, y);
      const sign = txn.type === 'income' ? '+' : '-';
      doc.text(`${sign}${this.formatCurrency(txn.amount)}`, PAGE_WIDTH - PAGE_MARGIN, y, { align: 'right' });
      y += 6;
    }

    return y + 6;
  }

  private ensureSpace(doc: jsPDF, y: number, needed: number): number {
    if (y + needed <= PAGE_HEIGHT - PAGE_MARGIN) return y;
    doc.addPage();
    return PAGE_MARGIN;
  }

  private truncate(value: string, max: number): string {
    return value.length > max ? `${value.slice(0, max - 1)}…` : value;
  }

  private formatCurrency(value: number): string {
    return this.currencyFormatter.format(value);
  }

  private formatDate(date: Date): string {
    return this.dateFormatter.format(date);
  }

  private formatShortDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${date.getFullYear()}`;
  }

  private fileDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
