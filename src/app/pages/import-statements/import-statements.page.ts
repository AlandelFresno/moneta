import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, combineLatest } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DatePickerModule } from 'primeng/datepicker';
import { MessageService } from 'primeng/api';

import { Account } from '../../core/types/account.types';
import { Category } from '../../core/types/category.types';
import { Transaction } from '../../core/types/transaction.types';
import { Bill } from '../../core/types/bill.types';
import { ParsedStatementRow, StatementParseResult } from '../../core/types/statement-import.types';
import { AccountService } from '../../services/account.service';
import { CategoryService } from '../../services/category.service';
import { TransactionService } from '../../services/transaction.service';
import { BillService } from '../../services/bill.service';
import { StatementImportService } from '../../services/statement-import.service';

@Component({
  selector: 'app-import-statements',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    SelectModule,
    CheckboxModule,
    InputTextModule,
    InputNumberModule,
    DatePickerModule
  ],
  templateUrl: './import-statements.page.html',
  styleUrl: './import-statements.page.scss'
})
export class ImportStatementsPage implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  accounts: Account[] = [];
  categories: Category[] = [];
  bills: Bill[] = [];
  private transactions: Transaction[] = [];

  rows: ParsedStatementRow[] = [];
  parseErrors: string[] = [];
  isParsing = false;
  lastSources: string[] = [];

  constructor(
    private readonly accountService: AccountService,
    private readonly categoryService: CategoryService,
    private readonly transactionService: TransactionService,
    private readonly billService: BillService,
    private readonly statementImportService: StatementImportService,
    private readonly messageService: MessageService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    combineLatest([
      this.accountService.getAll(),
      this.categoryService.getAll(),
      this.transactionService.getAll(),
      this.billService.getAll()
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([accounts, categories, transactions, bills]) => {
        this.accounts = accounts;
        this.categories = categories;
        this.transactions = transactions;
        this.bills = bills.filter((bill) => bill.active);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async onFilesSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (files.length === 0) return;

    const defaultAccountId = this.accounts[0]?.id ?? '';
    this.isParsing = true;
    this.cdr.markForCheck();
    let totalParsedRows = 0;

    for (const file of files) {
      try {
        const result: StatementParseResult = await this.statementImportService.parseFile(file);
        totalParsedRows += result.rows.length;
        this.lastSources = [...new Set([...this.lastSources, result.source])];
        this.parseErrors = [...this.parseErrors, ...result.errors];
        this.rows = [
          ...this.rows,
          ...this.statementImportService.annotate(result, this.transactions, defaultAccountId)
        ];
      } catch (error) {
        this.messageService.add({
          severity: 'error',
          summary: `Error al leer ${file.name}`,
          detail: error instanceof Error ? error.message : 'Formato inválido'
        });
      }
      this.cdr.markForCheck();
    }

    this.isParsing = false;
    this.cdr.markForCheck();

    if (totalParsedRows === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Nada para importar',
        detail: 'No se encontraron movimientos reconocibles en los archivos'
      });
    }
  }

  categoriesForType(row: ParsedStatementRow): Category[] {
    return this.categories.filter((cat) => cat.type === row.type);
  }

  /** Bills are always expenses in this app's domain — nothing to link for an income row. */
  billsForRow(row: ParsedStatementRow): Bill[] {
    return row.type === 'expense' ? this.bills : [];
  }

  get includedCount(): number {
    return this.rows.filter((row) => row.include).length;
  }

  get readyCount(): number {
    return this.rows.filter((row) => row.include && row.categoryId).length;
  }

  selectAllNew(): void {
    this.rows = this.rows.map((row) => ({ ...row, include: !row.isDuplicate }));
  }

  selectNone(): void {
    this.rows = this.rows.map((row) => ({ ...row, include: false }));
  }

  removeRow(row: ParsedStatementRow): void {
    this.rows = this.rows.filter((r) => r.rowId !== row.rowId);
  }

  toggleType(row: ParsedStatementRow): void {
    row.type = row.type === 'income' ? 'expense' : 'income';
    if (!this.categoriesForType(row).some((cat) => cat.id === row.categoryId)) {
      row.categoryId = '';
    }
    if (row.type === 'income') {
      row.billId = undefined;
    }
  }

  /** Creates just this one row's transaction, independent of its checkbox/`include` state. */
  async acceptRow(row: ParsedStatementRow): Promise<void> {
    if (!row.categoryId) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Faltan datos',
        detail: 'Asigná una categoría a esta fila antes de aceptarla'
      });
      return;
    }

    const created = await this.statementImportService.commitOne(row);
    if (created) {
      this.rows = this.rows.filter((r) => r.rowId !== row.rowId);
      this.messageService.add({ severity: 'success', summary: 'Transacción creada', detail: row.name });
    }
    this.cdr.markForCheck();
  }

  clearAll(): void {
    this.rows = [];
    this.parseErrors = [];
    this.lastSources = [];
  }

  async importSelected(): Promise<void> {
    const missing = this.rows.some((row) => row.include && !row.categoryId);
    if (missing) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Faltan datos',
        detail: 'Asigná una categoría a cada fila incluida antes de importar'
      });
      return;
    }

    const count = await this.statementImportService.commit(this.rows);
    this.rows = this.rows.filter((row) => !row.include);
    this.cdr.markForCheck();

    this.messageService.add({
      severity: 'success',
      summary: 'Importación completada',
      detail: `${count} transacciones creadas`
    });
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  }
}
