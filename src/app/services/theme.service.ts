import { Injectable, signal } from '@angular/core';
import { palette, ThemeColors } from '../theme.tokens';

export type Theme = 'light' | 'dark';

const CSS_VAR_NAMES: Record<keyof ThemeColors, string> = {
  surfacePage: '--surface-page',
  surfaceCard: '--surface-card',
  surfaceInput: '--surface-input',
  borderSubtle: '--border-subtle',
  borderStrong: '--border-strong',
  textPrimary: '--text-primary',
  textSecondary: '--text-secondary',
  accent: '--accent',
  accentStrong: '--accent-strong',
  income: '--income',
  expense: '--expense'
};

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly storageKey = 'theme';
  readonly theme = signal<Theme>(this.loadTheme());

  constructor() {
    this.applyTheme(this.theme());
  }

  private loadTheme(): Theme {
    const stored = localStorage.getItem(this.storageKey);
    return stored === 'dark' ? 'dark' : 'light';
  }

  toggle(): void {
    const next: Theme = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(next);
    localStorage.setItem(this.storageKey, next);
    this.applyTheme(next);
  }

  private applyTheme(theme: Theme): void {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    this.setCssVariables(palette[theme]);
  }

  private setCssVariables(colors: ThemeColors): void {
    const root = document.documentElement.style;
    for (const key of Object.keys(colors) as (keyof ThemeColors)[]) {
      root.setProperty(CSS_VAR_NAMES[key], colors[key]);
    }
  }
}
