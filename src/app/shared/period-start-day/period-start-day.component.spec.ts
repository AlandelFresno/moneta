import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { PeriodStartDayComponent } from './period-start-day.component';

describe('PeriodStartDayComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('loads the default day/hour when nothing is stored', () => {
    const component = TestBed.createComponent(PeriodStartDayComponent).componentInstance;
    expect(component.day).toBe(1);
    expect(component.hour).toBe(0);
  });

  it('loads a previously stored day/hour', () => {
    localStorage.setItem('period_start_day', '15');
    localStorage.setItem('period_start_hour', '9');
    const component = TestBed.createComponent(PeriodStartDayComponent).componentInstance;
    expect(component.day).toBe(15);
    expect(component.hour).toBe(9);
  });

  it('onBlur() persists the current values, clamps them and emits settingsChange', () => {
    const component = TestBed.createComponent(PeriodStartDayComponent).componentInstance;
    const emitted: void[] = [];
    component.settingsChange.subscribe(() => emitted.push(undefined));

    component.day = 40;
    component.hour = -3;
    component.onBlur();

    expect(component.day).toBe(28);
    expect(component.hour).toBe(0);
    expect(localStorage.getItem('period_start_day')).toBe('28');
    expect(localStorage.getItem('period_start_hour')).toBe('0');
    expect(emitted.length).toBe(1);
  });
});
