import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';

import { Transaction } from '../../core/types/transaction.types';
import { TransactionService } from '../../services/transaction.service';
import { PeriodSettingsService } from '../../services/period-settings.service';
import { PeriodStartDayComponent } from '../../shared/period-start-day/period-start-day.component';
import { addMonths, periodHistory, periodLabelMonth, periodMarkerTransaction, PeriodOccurrence } from '../../core/utils/period.util';
import { formatDate, formatDateTime, formatMonthLabel } from '../../core/utils/date-display.util';

interface PeriodRow {
  label: string;
  start: Date;
  end: Date;
  days: number;
  isCurrent: boolean;
  marker: Transaction | null;
}

const PERIODS_SHOWN = 6;

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, PeriodStartDayComponent],
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss'
})
export class SettingsPage implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  private transactions: Transaction[] = [];

  startDay = 1;
  startHour = 0;
  periods: PeriodRow[] = [];

  constructor(
    private readonly transactionService: TransactionService,
    private readonly periodSettingsService: PeriodSettingsService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.transactionService
      .getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe((transactions) => {
        this.transactions = transactions;
        this.recompute();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onPeriodSettingsChange(): void {
    this.recompute();
  }

  get currentMarker(): Transaction | null {
    return this.periods[0]?.marker ?? null;
  }

  formatDate(date: Date): string {
    return formatDate(date);
  }

  formatDateTime(date: Date): string {
    return formatDateTime(date);
  }

  private recompute(): void {
    this.startDay = this.periodSettingsService.getStartDay();
    this.startHour = this.periodSettingsService.getStartHour();

    const reference = new Date();
    const occurrences: PeriodOccurrence[] = periodHistory(
      addMonths(reference, -(PERIODS_SHOWN - 1)),
      reference,
      this.startDay,
      this.startHour,
      this.transactions
    ).reverse();

    this.periods = occurrences.map((occurrence, index) => ({
      label: formatMonthLabel(periodLabelMonth(occurrence.start, this.startDay)),
      start: occurrence.start,
      end: occurrence.end,
      days: occurrence.days,
      isCurrent: index === 0,
      marker: periodMarkerTransaction(occurrence, this.transactions) ?? null
    }));

    this.cdr.markForCheck();
  }
}
