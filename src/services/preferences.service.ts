import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface UserPreferences {
  preferredCurrency: string;
  secondaryCurrency?: string;  // Moneda a mostrar en paréntesis
  locale: string;
  theme?: 'light' | 'dark';
  dollarType?: 'oficial' | 'blue' | 'mep' | 'ccl' | 'mayorista';  // Tipo de dólar a usar para tasas argentinas
}

@Injectable({
  providedIn: 'root'
})
export class PreferencesService {
  private readonly STORAGE_KEY = 'budget_preferences';

  private defaultPreferences: UserPreferences = {
    preferredCurrency: 'ARS',
    secondaryCurrency: 'USD',
    locale: 'es-AR',
    theme: 'light',
    dollarType: 'oficial'
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
   * Obtiene la moneda secundaria
   */
  getSecondaryCurrency(): string | undefined {
    return this.preferencesSubject.value.secondaryCurrency;
  }

  /**
   * Establece la moneda secundaria (para mostrar en paréntesis)
   */
  setSecondaryCurrency(currency: string): void {
    const current = this.preferencesSubject.value;
    this.savePreferences({ ...current, secondaryCurrency: currency });
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

  /**
   * Obtiene el tipo de dólar preferido
   */
  getDollarType(): 'oficial' | 'blue' | 'mep' | 'ccl' | 'mayorista' {
    return this.preferencesSubject.value.dollarType || 'oficial';
  }

  /**
   * Establece el tipo de dólar a usar
   */
  setDollarType(dollarType: 'oficial' | 'blue' | 'mep' | 'ccl' | 'mayorista'): void {
    const current = this.preferencesSubject.value;
    this.savePreferences({ ...current, dollarType });
  }
}
