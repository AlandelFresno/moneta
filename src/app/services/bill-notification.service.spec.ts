import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { BillNotificationService, buildScheduledNotifications, numericIdFromString } from './bill-notification.service';
import { Bill } from '../core/types/bill.types';
import { BillDueStatus } from './bill.service';

function bill(overrides: Partial<Bill>): Bill {
  return {
    id: 'bill-1',
    name: 'Netflix',
    description: '',
    categoryId: 'cat-1',
    approxAmount: 6000,
    period: 'monthly',
    dueDate: new Date(2026, 0, 10),
    active: true,
    payments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

function dueStatus(overrides: Partial<Bill>, periodDueDate: Date): BillDueStatus {
  return { bill: bill(overrides), periodDueDate, isOverdue: false };
}

describe('numericIdFromString', () => {
  it('is deterministic for the same input', () => {
    expect(numericIdFromString('bill-1')).toBe(numericIdFromString('bill-1'));
  });

  it('is always a positive integer', () => {
    expect(numericIdFromString('bill-1')).toBeGreaterThan(0);
    expect(numericIdFromString('')).toBeGreaterThan(0);
    expect(numericIdFromString('x'.repeat(50))).toBeGreaterThan(0);
  });

  it('differs for different inputs', () => {
    expect(numericIdFromString('bill-1')).not.toBe(numericIdFromString('bill-2'));
  });
});

describe('buildScheduledNotifications', () => {
  const now = new Date(2026, 0, 1, 12);

  it('schedules one notification per due bill, `daysBefore` days ahead at 9am', () => {
    const dueBills = [dueStatus({ id: 'bill-1', name: 'Netflix' }, new Date(2026, 0, 10))];

    const result = buildScheduledNotifications(dueBills, 2, now);

    expect(result.length).toBe(1);
    expect(result[0].id).toBe(numericIdFromString('bill-1'));
    expect(result[0].schedule?.at).toEqual(new Date(2026, 0, 8, 9));
    expect(result[0].body).toContain('Netflix');
  });

  it('excludes notifications whose computed notify time has already passed', () => {
    // Due today, daysBefore=5 would notify 5 days in the past relative to `now`.
    const dueBills = [dueStatus({ id: 'bill-1' }, new Date(2026, 0, 1))];

    const result = buildScheduledNotifications(dueBills, 5, now);

    expect(result.length).toBe(0);
  });

  it('produces independent entries for multiple bills', () => {
    const dueBills = [
      dueStatus({ id: 'bill-1', name: 'Netflix' }, new Date(2026, 0, 10)),
      dueStatus({ id: 'bill-2', name: 'Internet' }, new Date(2026, 0, 15))
    ];

    const result = buildScheduledNotifications(dueBills, 1, now);

    expect(result.length).toBe(2);
    expect(result.map((n) => n.id).sort()).toEqual([numericIdFromString('bill-1'), numericIdFromString('bill-2')].sort());
  });
});

describe('BillNotificationService', () => {
  let service: BillNotificationService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    service = TestBed.inject(BillNotificationService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('defaults to disabled with a 1-day reminder', () => {
    expect(service.settings()).toEqual({ enabled: false, daysBefore: 1 });
  });

  it('is not supported outside a native platform (this test runs in a browser)', () => {
    expect(service.isSupported()).toBeFalse();
  });

  it('setEnabled(true) returns false and does not persist on an unsupported platform', async () => {
    const result = await service.setEnabled(true);

    expect(result).toBeFalse();
    expect(service.settings().enabled).toBeFalse();
  });

  it('setEnabled(false) persists and succeeds even when unsupported', async () => {
    const result = await service.setEnabled(false);

    expect(result).toBeTrue();
    expect(service.settings().enabled).toBeFalse();
  });

  it('setDaysBefore persists the new value', async () => {
    await service.setDaysBefore(3);

    expect(service.settings().daysBefore).toBe(3);
  });
});
