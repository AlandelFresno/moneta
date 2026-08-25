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

  it('defaults to hour 0', () => {
    expect(service.getStartHour()).toBe(0);
  });

  it('persists a set hour value', () => {
    service.setStartHour(14);
    expect(service.getStartHour()).toBe(14);
  });

  it('clamps hour below the minimum up to 0', () => {
    service.setStartHour(-3);
    expect(service.getStartHour()).toBe(0);
  });

  it('clamps hour above the maximum down to 23', () => {
    service.setStartHour(30);
    expect(service.getStartHour()).toBe(23);
  });

  it('rounds a fractional hour value', () => {
    service.setStartHour(14.6);
    expect(service.getStartHour()).toBe(15);
  });

  it('persists hour across service instances via localStorage', () => {
    service.setStartHour(14);
    const fresh = new PeriodSettingsService();
    expect(fresh.getStartHour()).toBe(14);
  });

  it('keeps day and hour independent', () => {
    service.setStartDay(6);
    service.setStartHour(14);
    expect(service.getStartDay()).toBe(6);
    expect(service.getStartHour()).toBe(14);
  });
});
