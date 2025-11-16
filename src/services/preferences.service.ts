import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface UserPreferences {
  preferredCurrency: string;
  locale: string;
  theme?: 'light' | 'dark';
}

@Injectable({
  providedIn: 'root'
})
export class PreferencesService {
  private readonly STORAGE_KEY = 'budget_preferences';

  private defaultPreferences: UserPreferences = {
    preferredCurrency: 'USD',
    locale: 'es-AR',
    theme: 'light'
  };

  private preferencesSubject = new BehaviorSubject<UserPreferences>(this.defaultPreferences);
  public preferences$ = this.preferencesSubject.asObservable();

  constructor() {
    this.loadPreferences();
  }

  /**
   * Carga las preferencias desde localStorage
   */
  private loadPreferences(): void {
    const cached = localStorage.getItem(this.STORAGE_KEY);
    if (cached) {
      try {
        const preferences = JSON.parse(cached) as UserPreferences;
        this.preferencesSubject.next({ ...this.defaultPreferences, ...preferences });
      } catch (error) {
        console.error('Error loading preferences:', error);
        this.preferencesSubject.next(this.defaultPreferences);
      }
    }
  }

  /**
   * Guarda las preferencias en localStorage
   */
  private savePreferences(preferences: UserPreferences): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(preferences));
    this.preferencesSubject.next(preferences);
  }

  /**
   * Obtiene las preferencias actuales
   */
  getPreferences(): UserPreferences {
    return this.preferencesSubject.value;
  }

  /**
   * Obtiene la moneda preferida
   */
  getPreferredCurrency(): string {
    return this.preferencesSubject.value.preferredCurrency;
  }

  /**
   * Establece la moneda preferida
   */
  setPreferredCurrency(currency: string): void {
    const current = this.preferencesSubject.value;
    this.savePreferences({ ...current, preferredCurrency: currency });
  }

  /**
   * Obtiene el locale preferido
   */
  getLocale(): string {
    return this.preferencesSubject.value.locale;
  }

  /**
   * Establece el locale
   */
  setLocale(locale: string): void {
    const current = this.preferencesSubject.value;
    this.savePreferences({ ...current, locale });
  }

  /**
   * Actualiza múltiples preferencias a la vez
   */
  updatePreferences(partial: Partial<UserPreferences>): void {
    const current = this.preferencesSubject.value;
    this.savePreferences({ ...current, ...partial });
  }
}
