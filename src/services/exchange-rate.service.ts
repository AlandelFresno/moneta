import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';

export interface ExchangeRates {
  base: string;
  date: string;
  rates: { [key: string]: number };
  timestamp: number; // Cuando se obtuvieron los datos
}

export interface CacheInfo {
  isValid: boolean;
  age: string; // 'today', 'yesterday', 'expired'
  lastUpdate: Date | null;
  needsUpdate: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ExchangeRateService {
  private readonly STORAGE_KEY = 'budget_exchange_rates';
  private readonly API_URL = 'https://api.exchangerate-api.com/v4/latest/';

  private ratesSubject = new BehaviorSubject<ExchangeRates | null>(null);
  public rates$ = this.ratesSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadRatesFromCache();
  }

  /**
   * Carga las tasas desde localStorage
   */
  private loadRatesFromCache(): void {
    const cached = localStorage.getItem(this.STORAGE_KEY);
    if (cached) {
      try {
        const rates = JSON.parse(cached) as ExchangeRates;
        this.ratesSubject.next(rates);
      } catch (error) {
        console.error('Error loading cached rates:', error);
      }
    }
  }

  /**
   * Guarda las tasas en localStorage
   */
  private saveRatesToCache(rates: ExchangeRates): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(rates));
    this.ratesSubject.next(rates);
  }

  /**
   * Verifica si el caché es válido (máximo 1 día: solo día actual o anterior)
   */
  getCacheInfo(): CacheInfo {
    const rates = this.ratesSubject.value;

    if (!rates || !rates.timestamp) {
      return {
        isValid: false,
        age: 'expired',
        lastUpdate: null,
        needsUpdate: true
      };
    }

    const now = new Date();
    const cacheDate = new Date(rates.timestamp);

    // Resetear horas para comparar solo fechas
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const cacheDateStart = new Date(cacheDate.getFullYear(), cacheDate.getMonth(), cacheDate.getDate());

    const diffTime = todayStart.getTime() - cacheDateStart.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    let age: 'today' | 'yesterday' | 'expired';
    let isValid: boolean;

    if (diffDays === 0) {
      age = 'today';
      isValid = true;
    } else if (diffDays === 1) {
      age = 'yesterday';
      isValid = true;
    } else {
      age = 'expired';
      isValid = false;
    }

    return {
      isValid,
      age,
      lastUpdate: cacheDate,
      needsUpdate: !isValid
    };
  }

  /**
   * Obtiene las tasas de cambio más recientes
   * Si el caché es válido (máximo 1 día), retorna las tasas en caché
   * Si no, obtiene nuevas tasas desde la API
   */
  async getRates(baseCurrency: string = 'ARS', forceUpdate: boolean = false): Promise<ExchangeRates> {
    const cacheInfo = this.getCacheInfo();
    const currentRates = this.ratesSubject.value;

    // Si no se fuerza actualización y el caché es válido y es para la misma moneda base
    if (!forceUpdate && cacheInfo.isValid && currentRates && currentRates.base === baseCurrency) {
      return currentRates;
    }

    // Obtener tasas frescas desde la API
    return this.fetchRatesFromAPI(baseCurrency);
  }

  /**
   * Obtiene tasas desde la API
   */
  private async fetchRatesFromAPI(baseCurrency: string): Promise<ExchangeRates> {
    try {
      const response = await firstValueFrom(
        this.http.get<any>(`${this.API_URL}${baseCurrency}`)
      );

      const rates: ExchangeRates = {
        base: response.base,
        date: response.date,
        rates: response.rates,
        timestamp: Date.now()
      };

      this.saveRatesToCache(rates);
      return rates;
    } catch (error) {
      console.error('Error fetching exchange rates:', error);

      // Si hay error pero tenemos caché (aunque esté expirado), usarlo
      const currentRates = this.ratesSubject.value;
      if (currentRates) {
        console.warn('Using expired cache due to API error');
        return currentRates;
      }

      throw new Error('No se pudieron obtener las tasas de cambio y no hay caché disponible');
    }
  }

  /**
   * Actualiza las tasas manualmente (fuerza una actualización)
   */
  async updateRatesManually(baseCurrency: string = 'ARS'): Promise<ExchangeRates> {
    return this.getRates(baseCurrency, true);
  }

  /**
   * Convierte un monto de una moneda a otra
   */
  async convert(amount: number, fromCurrency: string, toCurrency: string): Promise<number> {
    if (fromCurrency === toCurrency) {
      return amount;
    }

    const rates = await this.getRates('USD'); // Usar USD como base común

    // Convertir a USD primero, luego a la moneda destino
    const amountInUSD = fromCurrency === 'USD'
      ? amount
      : amount / rates.rates[fromCurrency];

    const convertedAmount = toCurrency === 'USD'
      ? amountInUSD
      : amountInUSD * rates.rates[toCurrency];

    return convertedAmount;
  }

  /**
   * Convierte un monto a la moneda preferida (ARS) de forma síncrona
   * usando las tasas en caché
   */
  convertToPreferredCurrency(amount: number, fromCurrency: string, preferredCurrency: string = 'ARS'): number {
    if (fromCurrency === preferredCurrency) {
      return amount;
    }

    const rates = this.ratesSubject.value;
    if (!rates) {
      return amount; // Sin tasas, retornar el monto original
    }

    try {
      // Convertir a la moneda base de las tasas
      const amountInBase = fromCurrency === rates.base
        ? amount
        : amount / rates.rates[fromCurrency];

      // Convertir a la moneda preferida
      const convertedAmount = preferredCurrency === rates.base
        ? amountInBase
        : amountInBase * rates.rates[preferredCurrency];

      return convertedAmount;
    } catch (error) {
      console.error('Error converting currency:', error);
      return amount;
    }
  }

  /**
   * Obtiene la tasa de cambio entre dos monedas
   */
  getExchangeRate(fromCurrency: string, toCurrency: string): number {
    if (fromCurrency === toCurrency) {
      return 1;
    }

    const rates = this.ratesSubject.value;
    if (!rates) {
      return 1;
    }

    try {
      if (fromCurrency === rates.base) {
        return rates.rates[toCurrency];
      }

      if (toCurrency === rates.base) {
        return 1 / rates.rates[fromCurrency];
      }

      // Convertir a través de la moneda base
      const toBase = 1 / rates.rates[fromCurrency];
      const toTarget = rates.rates[toCurrency];
      return toBase * toTarget;
    } catch (error) {
      console.error('Error getting exchange rate:', error);
      return 1;
    }
  }
}
