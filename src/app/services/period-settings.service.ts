import { Injectable } from '@angular/core';

const DAY_STORAGE_KEY = 'period_start_day';
const DEFAULT_START_DAY = 1;
const MIN_START_DAY = 1;
const MAX_START_DAY = 28;

const HOUR_STORAGE_KEY = 'period_start_hour';
const DEFAULT_START_HOUR = 0;
const MIN_START_HOUR = 0;
const MAX_START_HOUR = 23;

@Injectable({
  providedIn: 'root'
})
export class PeriodSettingsService {
  getStartDay(): number {
    const raw = localStorage.getItem(DAY_STORAGE_KEY);
    if (!raw) return DEFAULT_START_DAY;

    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? this.clampDay(parsed) : DEFAULT_START_DAY;
  }

  setStartDay(day: number): void {
    localStorage.setItem(DAY_STORAGE_KEY, String(this.clampDay(day)));
  }

  getStartHour(): number {
    const raw = localStorage.getItem(HOUR_STORAGE_KEY);
    if (!raw) return DEFAULT_START_HOUR;

    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? this.clampHour(parsed) : DEFAULT_START_HOUR;
  }

  setStartHour(hour: number): void {
    localStorage.setItem(HOUR_STORAGE_KEY, String(this.clampHour(hour)));
  }

  private clampDay(day: number): number {
    return Math.min(MAX_START_DAY, Math.max(MIN_START_DAY, Math.round(day)));
  }

  private clampHour(hour: number): number {
    return Math.min(MAX_START_HOUR, Math.max(MIN_START_HOUR, Math.round(hour)));
  }
}
