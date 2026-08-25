import { Injectable } from '@angular/core';
import { debounceTime } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications, LocalNotificationSchema } from '@capacitor/local-notifications';
import { BillService, BillDueStatus } from './bill.service';

export interface BillNotificationSettings {
  enabled: boolean;
  daysBefore: number;
}

const DEFAULT_SETTINGS: BillNotificationSettings = { enabled: false, daysBefore: 1 };
const HORIZON_DAYS = 30;
const NOTIFY_HOUR = 9;

/** Deterministic positive int id — Capacitor notification ids must be numbers, Bill ids are strings. */
export function numericIdFromString(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 1;
}

/** Pure: which notifications should be scheduled right now, given the due bills and how many days ahead to warn. Past-due notify times are dropped rather than fired immediately. */
export function buildScheduledNotifications(
  dueBills: BillDueStatus[],
  daysBefore: number,
  now: Date
): LocalNotificationSchema[] {
  return dueBills
    .map(({ bill, periodDueDate }) => {
      const notifyAt = new Date(periodDueDate.getFullYear(), periodDueDate.getMonth(), periodDueDate.getDate() - daysBefore, NOTIFY_HOUR);
      return {
        id: numericIdFromString(bill.id),
        title: 'Vencimiento próximo',
        body: `${bill.name} vence el ${periodDueDate.toLocaleDateString('es-AR')}`,
        schedule: { at: notifyAt }
      };
    })
    .filter((notification) => notification.schedule!.at!.getTime() > now.getTime());
}

@Injectable({
  providedIn: 'root'
})
export class BillNotificationService {
  private readonly SETTINGS_KEY = 'bill_notifications_settings';
  private readonly SCHEDULED_IDS_KEY = 'bill_notifications_scheduled_ids';

  constructor(private readonly billService: BillService) {
    this.billService.getAll().pipe(debounceTime(500)).subscribe((bills) => {
      if (this.settings().enabled) {
        void this.reschedule(bills);
      }
    });
  }

  isSupported(): boolean {
    return Capacitor.isNativePlatform();
  }

  settings(): BillNotificationSettings {
    const raw = localStorage.getItem(this.SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  }

  private persistSettings(settings: BillNotificationSettings): void {
    localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
  }

  /** Returns false (and leaves the setting off) if unsupported on this platform, or if the user denies the OS permission prompt. */
  async setEnabled(enabled: boolean): Promise<boolean> {
    if (enabled && !this.isSupported()) {
      return false;
    }

    if (enabled) {
      const granted = await this.requestPermission();
      if (!granted) {
        this.persistSettings({ ...this.settings(), enabled: false });
        return false;
      }
    }

    this.persistSettings({ ...this.settings(), enabled });

    if (enabled) {
      await this.reschedule(this.billService.getAllIncludingDeleted());
    } else {
      await this.cancelAll();
    }
    return true;
  }

  async setDaysBefore(daysBefore: number): Promise<void> {
    this.persistSettings({ ...this.settings(), daysBefore });
    if (this.settings().enabled) {
      await this.reschedule(this.billService.getAllIncludingDeleted());
    }
  }

  private async requestPermission(): Promise<boolean> {
    const result = await LocalNotifications.requestPermissions();
    return result.display === 'granted';
  }

  private async reschedule(bills: BillDueStatus['bill'][]): Promise<void> {
    if (!this.isSupported()) return;

    await this.cancelAll();

    const dueBills = this.billService.upcomingBills(bills, new Date(), HORIZON_DAYS);
    const notifications = buildScheduledNotifications(dueBills, this.settings().daysBefore, new Date());
    if (notifications.length === 0) return;

    await LocalNotifications.schedule({ notifications });
    localStorage.setItem(this.SCHEDULED_IDS_KEY, JSON.stringify(notifications.map((n) => n.id)));
  }

  private async cancelAll(): Promise<void> {
    if (!this.isSupported()) return;

    const raw = localStorage.getItem(this.SCHEDULED_IDS_KEY);
    const ids: number[] = raw ? JSON.parse(raw) : [];
    if (ids.length > 0) {
      await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
    }
    localStorage.setItem(this.SCHEDULED_IDS_KEY, JSON.stringify([]));
  }
}
