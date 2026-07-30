import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { PreferencesService } from './preferences.service';

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

export interface DolarApiResponse {
  compra: number;
  venta: number;
  casa: string;
  nombre: string;
  moneda: string;
  fechaActualizacion: string;
}

@Injectable({
  providedIn: 'root'
})
export class ExchangeRateService {
  private readonly STORAGE_KEY = 'budget_exchange_rates';
  private readonly API_URL = 'https://api.exchangerate-api.com/v4/latest/';
  private readonly DOLAR_API_URL = 'https://dolarapi.com/v1/dolares';

  private ratesSubject = new BehaviorSubject<ExchangeRates | null>(null);
  public rates$ = this.ratesSubject.asObservable();

  constructor(
    private http: HttpClient,
    private preferencesService: PreferencesService
  ) {
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
   * Obtiene la tasa de dólar desde DolarApi.com (API argentina)
   */
  private async fetchArgentineDollarRate(): Promise<number> {
    const dollarType = this.preferencesService.getDollarType();
    console.log(`🇦🇷 [ExchangeRateService] Obteniendo tasa de dólar ${dollarType} desde DolarApi.com...`);

    try {
      const response = await firstValueFrom(
        this.http.get<DolarApiResponse[]>(this.DOLAR_API_URL)
      );

      // Buscar el tipo de dólar configurado
      let dolarData: DolarApiResponse | undefined;

      switch (dollarType) {
        case 'oficial':
          dolarData = response.find(d => d.nombre === 'Oficial');
          break;
        case 'blue':
          dolarData = response.find(d => d.nombre === 'Blue');
          break;
        case 'mep':
          dolarData = response.find(d => d.nombre === 'Bolsa');
          break;
        case 'ccl':
          dolarData = response.find(d => d.nombre === 'Contado con liquidación' || d.nombre === 'Contado con Liquidación');
          break;
        case 'mayorista':
          dolarData = response.find(d => d.nombre === 'Mayorista');
          break;
        default:
          dolarData = response.find(d => d.nombre === 'Oficial');
      }

      if (!dolarData) {
        console.warn(`⚠️ [ExchangeRateService] No se encontró tasa para dólar ${dollarType}, usando Oficial por defecto`);
        dolarData = response.find(d => d.nombre === 'Oficial');
      }

      if (!dolarData) {
        throw new Error('No se pudo obtener ninguna tasa de dólar');
      }

      // Usar el valor de VENTA del banco (lo que pagás cuando comprás dólares)
      const rate = dolarData.venta;

      console.log(`✅ [ExchangeRateService] Tasa de dólar ${dolarData.nombre} obtenida:`, {
        compra: dolarData.compra,
        venta: dolarData.venta,
        usada: rate,
        tipo: 'venta (lo que pagás al comprar dólares)',
        fecha: dolarData.fechaActualizacion
      });

      return rate;
    } catch (error) {
      console.error('❌ [ExchangeRateService] Error obteniendo tasa argentina:', error);
      throw error;
    }
  }

  /**
   * Obtiene tasas desde la API combinando datos internacionales con tasas argentinas
   */
  private async fetchRatesFromAPI(baseCurrency: string): Promise<ExchangeRates> {
    console.log(`🌐 [ExchangeRateService] Obteniendo tasas desde API para ${baseCurrency}...`);
    try {
      // Obtener tasas internacionales desde exchangerate-api.com
      const response = await firstValueFrom(
        this.http.get<any>(`${this.API_URL}${baseCurrency}`)
      );

      const rates: ExchangeRates = {
        base: response.base,
        date: response.date,
        rates: response.rates,
        timestamp: Date.now()
      };

      // Si la moneda base es USD, reemplazar la tasa ARS con la tasa argentina real
      if (baseCurrency === 'USD' && rates.rates['ARS']) {
        try {
          const argentineRate = await this.fetchArgentineDollarRate();
          console.log('🔄 [ExchangeRateService] Reemplazando tasa ARS internacional con tasa argentina:', {
            tasaInternacional: rates.rates['ARS'],
            tasaArgentina: argentineRate
          });
          rates.rates['ARS'] = argentineRate;
        } catch (argentineError) {
          console.warn('⚠️ [ExchangeRateService] Error obteniendo tasa argentina, usando tasa internacional:', argentineError);
        }
      }

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

    const rates = await this.getRates('ARS'); // Usar ARS como base común

    // Convertir a ARS primero, luego a la moneda destino
    const amountInARS = fromCurrency === 'ARS'
      ? amount
      : amount / rates.rates[fromCurrency];

    const convertedAmount = toCurrency === 'ARS'
      ? amountInARS
      : amountInARS * rates.rates[toCurrency];

    return convertedAmount;
  }

  /**
   * Convierte un monto a la moneda preferida (ARS) de forma síncrona
   * usando las tasas en caché
   */
  convertToPreferredCurrency(amount: number, fromCurrency: string, preferredCurrency: string = 'ARS'): number {
    // console.log(`💱 [ExchangeRateService] Convirtiendo ${amount} ${fromCurrency} → ${preferredCurrency}`);

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

      // console.log(`✅ [ExchangeRateService] Conversión exitosa:`, {
      //   from: `${amount} ${fromCurrency}`,
      //   to: `${convertedAmount.toFixed(2)} ${preferredCurrency}`,
      //   rate: `1 ${fromCurrency} = ${rate.toFixed(4)} ${preferredCurrency}`,
      //   base: rates.base
      // });

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

  /**
   * Obtiene todas las tasas de cambio para las monedas soportadas
   * Retorna cuánto de cada moneda equivale a 1 unidad de la moneda origen
   *
   * Ejemplo: getAllExchangeRates('USD') retorna:
   * - ARS: 1050 (significa 1 USD = 1050 ARS)
   * - USD: 1 (significa 1 USD = 1 USD)
   * - EUR: 0.95 (significa 1 USD = 0.95 EUR)
   * - BRL: 5.8 (significa 1 USD = 5.8 BRL)
   */
  getAllExchangeRates(fromCurrency: string): { ARS: number, USD: number, EUR: number, BRL: number } {
    console.log(`💱 [ExchangeRateService] getAllExchangeRates para ${fromCurrency}`);

    const rates = this.ratesSubject.value;
    console.log('📊 [ExchangeRateService] Tasas actuales de la API:', {
      base: rates?.base,
      USD: rates?.rates['USD'],
      ARS: rates?.rates['ARS'],
      EUR: rates?.rates['EUR'],
      BRL: rates?.rates['BRL']
    });

    const result = {
      ARS: this.getExchangeRate(fromCurrency, 'ARS'),
      USD: this.getExchangeRate(fromCurrency, 'USD'),
      EUR: this.getExchangeRate(fromCurrency, 'EUR'),
      BRL: this.getExchangeRate(fromCurrency, 'BRL')
    };

    console.log(`✅ [ExchangeRateService] Tasas calculadas para 1 ${fromCurrency}:`, {
      'ARS': `1 ${fromCurrency} = ${result.ARS.toFixed(4)} ARS`,
      'USD': `1 ${fromCurrency} = ${result.USD.toFixed(4)} USD`,
      'EUR': `1 ${fromCurrency} = ${result.EUR.toFixed(4)} EUR`,
      'BRL': `1 ${fromCurrency} = ${result.BRL.toFixed(4)} BRL`
    });

    return result;
  }
}
