import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { PeriodSettingsService } from './period-settings.service';

describe('PeriodSettingsService', () => {
  let service: PeriodSettingsService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    service = TestBed.inject(PeriodSettingsService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('defaults to day 1', () => {
    expect(service.getStartDay()).toBe(1);
  });

  it('persists a set value', () => {
    service.setStartDay(6);
    expect(service.getStartDay()).toBe(6);
  });

  it('clamps below the minimum up to 1', () => {
    service.setStartDay(0);
    expect(service.getStartDay()).toBe(1);
    service.setStartDay(-5);
    expect(service.getStartDay()).toBe(1);
  });

  it('clamps above the maximum down to 28', () => {
    service.setStartDay(31);
    expect(service.getStartDay()).toBe(28);
  });

  it('rounds a fractional value', () => {
    service.setStartDay(6.7);
    expect(service.getStartDay()).toBe(7);
  });

  it('persists across service instances via localStorage', () => {
    service.setStartDay(6);
    const fresh = new PeriodSettingsService();
    expect(fresh.getStartDay()).toBe(6);
  });
});
