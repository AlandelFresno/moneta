import { Injectable } from '@angular/core';
import { ExchangeRateService } from './exchange-rate.service';
import { PreferencesService } from './preferences.service';

export interface CurrencyDisplayOptions {
  showOriginal?: boolean; // Mostrar el valor original si es diferente a la moneda preferida
  compact?: boolean; // Formato compacto (K, M, etc)
}

export interface FormattedCurrency {
  primary: string; // Valor en moneda preferida (grande)
  secondary?: string; // Valor original (pequeño) si es diferente
  isConverted: boolean; // Si se realizó conversión
}

@Injectable({
  providedIn: 'root'
})
export class CurrencyDisplayService {
  constructor(
    private exchangeRateService: ExchangeRateService,
    private preferencesService: PreferencesService
  ) {}

  /**
   * Formatea un monto en la moneda especificada
   */
  formatAmount(amount: number, currency: string, locale?: string): string {
    const currentLocale = locale || this.preferencesService.getLocale();

    try {
      return new Intl.NumberFormat(currentLocale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount);
    } catch (error) {
      // Fallback si hay error con la moneda
      return `${this.getCurrencySymbol(currency)} ${amount.toFixed(2)}`;
    }
  }

  /**
   * Obtiene el símbolo de una moneda
   */
  private getCurrencySymbol(currency: string): string {
    const symbols: { [key: string]: string } = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'ARS': '$',
      'BRL': 'R$',
      'MXN': '$',
      'COP': '$',
      'CLP': '$',
      'JPY': '¥',
      'CNY': '¥'
    };
    return symbols[currency] || currency;
  }

  /**
   * Formatea un monto mostrando la moneda preferida como principal
   * y la moneda original como secundaria si es diferente
   */
  formatWithPreferredCurrency(
    amount: number,
    originalCurrency: string,
    options: CurrencyDisplayOptions = {}
  ): FormattedCurrency {
    // Validar amount
    if (!amount || isNaN(amount)) {
      amount = 0;
    }

    // Validar originalCurrency
    if (!originalCurrency || originalCurrency === 'undefined' || originalCurrency === 'null') {
      console.warn('Currency no válida en formatWithPreferredCurrency, usando ARS');
      originalCurrency = 'ARS';
    }

    const preferredCurrency = this.preferencesService.getPreferredCurrency();
    const showOriginal = options.showOriginal !== false; // Por defecto true

    // Si la moneda original es la preferida, solo mostrar una vez
    if (originalCurrency === preferredCurrency) {
      return {
        primary: this.formatAmount(amount, originalCurrency),
        isConverted: false
      };
    }

    // Convertir a la moneda preferida
    const convertedAmount = this.exchangeRateService.convertToPreferredCurrency(
      amount,
      originalCurrency,
      preferredCurrency
    );

    const result: FormattedCurrency = {
      primary: this.formatAmount(convertedAmount, preferredCurrency),
      isConverted: true
    };

    // Agregar el valor original si se solicita
    if (showOriginal) {
      result.secondary = this.formatAmount(amount, originalCurrency);
    }

    return result;
  }

  /**
   * Formatea múltiples montos y los suma en la moneda preferida
   */
  formatTotal(
    amounts: Array<{ amount: number; currency: string }>,
    options: CurrencyDisplayOptions = {}
  ): FormattedCurrency {
    const preferredCurrency = this.preferencesService.getPreferredCurrency();

    // Convertir todos los montos a la moneda preferida y sumar
    const total = amounts.reduce((sum, item) => {
      const converted = this.exchangeRateService.convertToPreferredCurrency(
        item.amount,
        item.currency,
        preferredCurrency
      );
      return sum + converted;
    }, 0);

    return {
      primary: this.formatAmount(total, preferredCurrency),
      isConverted: amounts.some(item => item.currency !== preferredCurrency)
    };
  }

  /**
   * Genera el HTML para mostrar el valor con formato dual
   * (valor principal + valor original pequeño)
   */
  getDisplayHTML(formatted: FormattedCurrency): string {
    if (!formatted.secondary) {
      return formatted.primary;
    }

    return `
      <span class="currency-display">
        <span class="primary-amount">${formatted.primary}</span>
        <span class="secondary-amount">(${formatted.secondary})</span>
      </span>
    `;
  }

  /**
   * Formatea un monto mostrando la moneda principal y secundaria configuradas
   * Usa las tasas guardadas en exchangeRates si están disponibles
   *
   * @param amount - Monto en la moneda original
   * @param currency - Moneda original del monto
   * @param exchangeRates - Tasas desde la moneda original hacia otras monedas
   *                        (ej: si currency=USD, exchangeRates.ARS=1050 significa 1 USD = 1050 ARS)
   */
  formatWithDualCurrency(
    amount: number,
    currency: string,
    exchangeRates?: { ARS: number, USD: number, EUR: number, BRL: number }
  ): FormattedCurrency {
    const primaryCurrency = this.preferencesService.getPreferredCurrency();
    const secondaryCurrency = this.preferencesService.getSecondaryCurrency();

    // console.log('💱 [CurrencyDisplay] formatWithDualCurrency llamado:', {
    //   amount,
    //   currency,
    //   primaryCurrency,
    //   secondaryCurrency,
    //   hasExchangeRates: !!exchangeRates,
    //   exchangeRates
    // });

    // Calcular monto en moneda principal
    let primaryAmount: number;
    if (currency === primaryCurrency) {
      primaryAmount = amount;
    } else if (exchangeRates && exchangeRates[primaryCurrency as keyof typeof exchangeRates]) {
      // Usar tasas guardadas (desde currency hacia primaryCurrency)
      primaryAmount = amount * exchangeRates[primaryCurrency as keyof typeof exchangeRates];
      // console.log('💱 [CurrencyDisplay] Usando tasa guardada para primary:', {
      //   rate: exchangeRates[primaryCurrency as keyof typeof exchangeRates],
      //   primaryAmount
      // });
    } else {
      // Fallback a conversión actual si no hay tasas guardadas
      primaryAmount = this.exchangeRateService.convertToPreferredCurrency(amount, currency, primaryCurrency);
      // console.log('💱 [CurrencyDisplay] Usando tasa actual (fallback) para primary:', primaryAmount);
    }

    const result: FormattedCurrency = {
      primary: this.formatAmount(primaryAmount, primaryCurrency),
      isConverted: currency !== primaryCurrency
    };

    // Agregar monto secundario si está configurado y es diferente de la primaria
    if (secondaryCurrency && secondaryCurrency !== primaryCurrency) {
      let secondaryAmount: number;
      if (currency === secondaryCurrency) {
        secondaryAmount = amount;
      } else if (exchangeRates && exchangeRates[secondaryCurrency as keyof typeof exchangeRates]) {
        // Usar tasas guardadas (desde currency hacia secondaryCurrency)
        secondaryAmount = amount * exchangeRates[secondaryCurrency as keyof typeof exchangeRates];
        // console.log('💱 [CurrencyDisplay] Usando tasa guardada para secondary:', {
        //   rate: exchangeRates[secondaryCurrency as keyof typeof exchangeRates],
        //   secondaryAmount
        // });
      } else {
        // Fallback a conversión actual si no hay tasas guardadas
        secondaryAmount = this.exchangeRateService.convertToPreferredCurrency(amount, currency, secondaryCurrency);
        // console.log('💱 [CurrencyDisplay] Usando tasa actual (fallback) para secondary:', secondaryAmount);
      }
      result.secondary = this.formatAmount(secondaryAmount, secondaryCurrency);
      // console.log('💱 [CurrencyDisplay] Secondary formateado:', result.secondary);
    } else {
      // console.log('💱 [CurrencyDisplay] No se agregó secondary porque:', {
      //   hasSecondaryCurrency: !!secondaryCurrency,
      //   isDifferentFromPrimary: secondaryCurrency !== primaryCurrency
      // });
    }

    // console.log('💱 [CurrencyDisplay] Resultado final:', result);
    return result;
  }
}
