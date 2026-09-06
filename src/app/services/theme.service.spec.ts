import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ThemeService } from './theme.service';
import { palette } from '../theme.tokens';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    document.documentElement.removeAttribute('style');
  });

  it('defaults to light theme and applies light CSS variables when nothing is stored', () => {
    const service = TestBed.inject(ThemeService);
    expect(service.theme()).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBeFalse();
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe(palette.light.accent);
  });

  it('loads the dark theme from localStorage and applies its CSS variables', () => {
    localStorage.setItem('theme', 'dark');
    const service = TestBed.inject(ThemeService);
    expect(service.theme()).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBeTrue();
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe(palette.dark.accent);
  });

  it('treats any unrecognized stored value as light', () => {
    localStorage.setItem('theme', 'sepia');
    const service = TestBed.inject(ThemeService);
    expect(service.theme()).toBe('light');
  });

  it('toggle() flips the theme, persists it and re-applies CSS variables', () => {
    const service = TestBed.inject(ThemeService);

    service.toggle();
    expect(service.theme()).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBeTrue();
    expect(document.documentElement.style.getPropertyValue('--expense')).toBe(palette.dark.expense);

    service.toggle();
    expect(service.theme()).toBe('light');
    expect(localStorage.getItem('theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBeFalse();
    expect(document.documentElement.style.getPropertyValue('--expense')).toBe(palette.light.expense);
  });
});
