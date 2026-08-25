import { Injectable } from '@angular/core';

const STORAGE_KEY = 'period_start_day';
const DEFAULT_START_DAY = 1;
const MIN_START_DAY = 1;
const MAX_START_DAY = 28;

@Injectable({
  providedIn: 'root'
})
export class PeriodSettingsService {
  getStartDay(): number {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_START_DAY;

    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? this.clamp(parsed) : DEFAULT_START_DAY;
  }

  setStartDay(day: number): void {
    localStorage.setItem(STORAGE_KEY, String(this.clamp(day)));
  }

  private clamp(day: number): number {
    return Math.min(MAX_START_DAY, Math.max(MIN_START_DAY, Math.round(day)));
  }
}
