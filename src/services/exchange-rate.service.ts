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
    console.log('🔄 [ExchangeRateService] Cargando tasas desde caché...');
    const cached = localStorage.getItem(this.STORAGE_KEY);
    if (cached) {
      try {
        const rates = JSON.parse(cached) as ExchangeRates;
        console.log('✅ [ExchangeRateService] Tasas cargadas desde caché:', {
          base: rates.base,
          date: rates.date,
          timestamp: new Date(rates.timestamp).toLocaleString(),
          currencies: Object.keys(rates.rates).length
        });
        this.ratesSubject.next(rates);
      } catch (error) {
        console.error('❌ [ExchangeRateService] Error loading cached rates:', error);
      }
    } else {
      console.log('⚠️ [ExchangeRateService] No hay tasas en caché');
    }
  }

  /**
   * Guarda las tasas en localStorage
   */
  private saveRatesToCache(rates: ExchangeRates): void {
    console.log('💾 [ExchangeRateService] Guardando tasas en caché:', {
      base: rates.base,
      date: rates.date,
      timestamp: new Date(rates.timestamp).toLocaleString(),
      sampleRates: {
        USD: rates.rates['USD'],
        ARS: rates.rates['ARS'],
        EUR: rates.rates['EUR']
      }
    });
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(rates));
    this.ratesSubject.next(rates);
  }

  /**
   * Verifica si el caché es válido (máximo 1 día: solo día actual o anterior)
   */
  getCacheInfo(): CacheInfo {
    const rates = this.ratesSubject.value;

    if (!rates || !rates.timestamp) {
      console.log('⚠️ [ExchangeRateService] getCacheInfo: No hay tasas disponibles');
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

    console.log('📊 [ExchangeRateService] Estado del caché:', {
      age,
      isValid,
      lastUpdate: cacheDate.toLocaleString(),
      diffDays,
      needsUpdate: !isValid
    });

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
    console.log(`🌐 [ExchangeRateService] Obteniendo tasas desde API para ${baseCurrency}...`);
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

      console.log('✅ [ExchangeRateService] Tasas obtenidas exitosamente:', {
        base: rates.base,
        date: rates.date,
        currencies: Object.keys(rates.rates).length,
        sampleRates: {
          ARS: rates.rates['ARS'],
          USD: rates.rates['USD'],
          EUR: rates.rates['EUR']
        }
      });

      this.saveRatesToCache(rates);
      return rates;
    } catch (error) {
      console.error('❌ [ExchangeRateService] Error fetching exchange rates:', error);

      // Si hay error pero tenemos caché (aunque esté expirado), usarlo
      const currentRates = this.ratesSubject.value;
      if (currentRates) {
        console.warn('⚠️ [ExchangeRateService] Using expired cache due to API error');
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
    console.log(`💱 [ExchangeRateService] Convirtiendo ${amount} ${fromCurrency} → ${preferredCurrency}`);

    // Validar que amount sea un número válido
    if (!amount || isNaN(amount)) {
      console.warn('⚠️ [ExchangeRateService] Monto inválido, retornando 0');
      return 0;
    }

    // Validar que fromCurrency exista y no sea undefined/null
    if (!fromCurrency || fromCurrency === 'undefined' || fromCurrency === 'null') {
      console.warn('⚠️ [ExchangeRateService] Currency no válida, usando ARS por defecto');
      fromCurrency = 'ARS';
    }

    // Si las monedas son iguales, retornar el monto original
    if (fromCurrency === preferredCurrency) {
      console.log('✅ [ExchangeRateService] Misma moneda, retornando monto original:', amount);
      return amount;
    }

    const rates = this.ratesSubject.value;
    if (!rates) {
      console.warn('⚠️ [ExchangeRateService] Sin tasas disponibles, retornando monto original');
      return amount; // Sin tasas, retornar el monto original
    }

    try {
      // Verificar que las monedas existan en las tasas
      if (fromCurrency !== rates.base && !rates.rates[fromCurrency]) {
        console.warn(`⚠️ [ExchangeRateService] Moneda ${fromCurrency} no encontrada en tasas, usando monto original`);
        return amount;
      }

      if (preferredCurrency !== rates.base && !rates.rates[preferredCurrency]) {
        console.warn(`⚠️ [ExchangeRateService] Moneda preferida ${preferredCurrency} no encontrada en tasas`);
        return amount;
      }

      // Convertir a la moneda base de las tasas
      const amountInBase = fromCurrency === rates.base
        ? amount
        : amount / rates.rates[fromCurrency];

      // Validar que la conversión intermedia sea válida
      if (isNaN(amountInBase)) {
        console.error('❌ [ExchangeRateService] Error en conversión intermedia');
        return amount;
      }

      // Convertir a la moneda preferida
      const convertedAmount = preferredCurrency === rates.base
        ? amountInBase
        : amountInBase * rates.rates[preferredCurrency];

      // Validar el resultado final
      if (isNaN(convertedAmount)) {
        console.error('❌ [ExchangeRateService] Error en conversión final');
        return amount;
      }

      const rate = fromCurrency === rates.base
        ? rates.rates[preferredCurrency]
        : (preferredCurrency === rates.base
          ? 1 / rates.rates[fromCurrency]
          : (1 / rates.rates[fromCurrency]) * rates.rates[preferredCurrency]);

      console.log(`✅ [ExchangeRateService] Conversión exitosa:`, {
        from: `${amount} ${fromCurrency}`,
        to: `${convertedAmount.toFixed(2)} ${preferredCurrency}`,
        rate: `1 ${fromCurrency} = ${rate.toFixed(4)} ${preferredCurrency}`,
        base: rates.base
      });

      return convertedAmount;
    } catch (error) {
      console.error('❌ [ExchangeRateService] Error converting currency:', error);
      return amount;
    }
  }

  /**
   * Obtiene la información actual de las tasas de cambio
   */
  getRatesInfo(): ExchangeRates | null {
    return this.ratesSubject.value;
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
      console.warn('⚠️ [ExchangeRateService] getExchangeRate: Sin tasas disponibles');
      return 1;
    }

    try {
      let rate: number;

      if (fromCurrency === rates.base) {
        rate = rates.rates[toCurrency];
      } else if (toCurrency === rates.base) {
        rate = 1 / rates.rates[fromCurrency];
      } else {
        // Convertir a través de la moneda base
        const toBase = 1 / rates.rates[fromCurrency];
        const toTarget = rates.rates[toCurrency];
        rate = toBase * toTarget;
      }

      console.log(`💱 [ExchangeRateService] Tasa obtenida: 1 ${fromCurrency} = ${rate.toFixed(4)} ${toCurrency}`);
      return rate;
    } catch (error) {
      console.error('❌ [ExchangeRateService] Error getting exchange rate:', error);
      return 1;
    }
  }
}
