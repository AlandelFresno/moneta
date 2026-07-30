import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { ExchangeRateService, CacheInfo } from '../../services/exchange-rate.service';
import { PreferencesService } from '../../services/preferences.service';
import { ToastService } from '../../services/toast.service';
import { Router } from '@angular/router';

interface CurrencyRate {
  code: string;
  name: string;
  symbol: string;
  rate: number;
  rateToPreferred: number;
  isEditing: boolean;
  editValue: number;
}

@Component({
  selector: 'app-currency-rates-widget',
  templateUrl: './currency-rates-widget.component.html',
  styleUrls: ['./currency-rates-widget.component.scss'],
  standalone: false
})
export class CurrencyRatesWidgetComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  preferredCurrency: string = 'ARS';
  cacheInfo: CacheInfo | null = null;
  topRates: CurrencyRate[] = [];
  isLoading = false;

  currencies = [
    { code: 'ARS', symbol: '$', name: 'Peso Argentino' },
    { code: 'USD', symbol: 'US$', name: 'Dólar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'BRL', symbol: 'R$', name: 'Real' },
    { code: 'GBP', symbol: '£', name: 'Libra' },
    { code: 'JPY', symbol: '¥', name: 'Yen' },
    { code: 'CNY', symbol: '¥', name: 'Yuan' },
    { code: 'MXN', symbol: '$', name: 'Peso MX' },
    { code: 'CLP', symbol: '$', name: 'Peso CL' },
    { code: 'UYU', symbol: '$', name: 'Peso UY' }
  ];

  constructor(
    private exchangeRateService: ExchangeRateService,
    private preferencesService: PreferencesService,
    private router: Router,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    console.log('🔄 [CurrencyRatesWidget] Inicializando widget...');
    this.loadData();

    // CRÍTICO: Suscribirse a cambios en preferencias para actualizar la tabla
    this.preferencesService.preferences$
      .pipe(takeUntil(this.destroy$))
      .subscribe(preferences => {
        const newCurrency = preferences.preferredCurrency;
        if (newCurrency !== this.preferredCurrency) {
          console.log(`💱 [CurrencyRatesWidget] Moneda preferida cambió de ${this.preferredCurrency} a ${newCurrency}`);
          this.preferredCurrency = newCurrency;
          this.buildTopRates();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData(): void {
    this.preferredCurrency = this.preferencesService.getPreferredCurrency();
    this.cacheInfo = this.exchangeRateService.getCacheInfo();
    console.log('📊 [CurrencyRatesWidget] Datos cargados:', {
      preferredCurrency: this.preferredCurrency,
      cacheAge: this.cacheInfo?.age,
      needsUpdate: this.cacheInfo?.needsUpdate
    });
    this.buildTopRates();
  }

  buildTopRates(): void {
    console.log(`💱 [CurrencyRatesWidget] Construyendo tabla de tasas para ${this.preferredCurrency}...`);

    // Mostrar las tasas más relevantes según la moneda preferida
    // Si la moneda preferida es USD, mostrar otras monedas en relación a USD
    // Si no, mostrar USD primero y luego otras monedas importantes

    const priorityCurrencies = this.preferredCurrency === 'USD'
      ? ['EUR', 'ARS', 'BRL', 'GBP']
      : ['USD', 'EUR', 'BRL', 'GBP'];

    this.topRates = priorityCurrencies
      .filter(code => code !== this.preferredCurrency)
      .map(code => {
        const currency = this.currencies.find(c => c.code === code);
        if (!currency) return null;

        // Calcular la tasa de 1 unidad de la moneda extranjera a la moneda preferida
        const rate = this.exchangeRateService.getExchangeRate(code, this.preferredCurrency);

        console.log(`  📊 ${code} → ${this.preferredCurrency}: ${rate.toFixed(6)}`);

        return {
          code: currency.code,
          name: currency.name,
          symbol: currency.symbol,
          rate: rate,
          rateToPreferred: rate,
          isEditing: false,
          editValue: rate
        };
      })
      .filter(r => r !== null) as CurrencyRate[];

    console.log(`✅ [CurrencyRatesWidget] Tabla construida con ${this.topRates.length} tasas`);
  }

  getCacheStatusClass(): string {
    if (!this.cacheInfo) return 'expired';
    return this.cacheInfo.age;
  }

  getCacheStatusText(): string {
    if (!this.cacheInfo) return 'Sin datos';

    switch (this.cacheInfo.age) {
      case 'today':
        return 'Actualizado hoy';
      case 'yesterday':
        return 'Actualizado ayer';
      case 'expired':
        return 'Desactualizado';
      default:
        return 'Desconocido';
    }
  }

  formatRate(rate: number): string {
    // Formatear el número con decimales apropiados
    if (rate >= 100) {
      return rate.toFixed(2);
    } else if (rate >= 1) {
      return rate.toFixed(4);
    } else {
      return rate.toFixed(6);
    }
  }

  navigateToSettings(): void {
    this.router.navigate(['/settings']);
  }

  async refreshRates(): Promise<void> {
    if (this.isLoading) return;

    console.log('🔄 [CurrencyRatesWidget] Actualizando tasas manualmente...');
    this.isLoading = true;
    try {
      await this.exchangeRateService.updateRatesManually('USD');
      console.log('✅ [CurrencyRatesWidget] Tasas actualizadas exitosamente');
      this.loadData();
    } catch (error) {
      console.error('❌ [CurrencyRatesWidget] Error refreshing rates:', error);
    } finally {
      this.isLoading = false;
    }
  }

  startEditRate(rate: CurrencyRate): void {
    rate.isEditing = true;
    rate.editValue = rate.rate;
  }

  cancelEditRate(rate: CurrencyRate): void {
    rate.isEditing = false;
  }

  saveEditRate(rate: CurrencyRate): void {
    console.log(`✏️ [CurrencyRatesWidget] Guardando tasa editada: ${rate.code} = ${rate.editValue}`);

    if (rate.editValue <= 0 || isNaN(rate.editValue)) {
      console.warn('⚠️ [CurrencyRatesWidget] Valor inválido');
      this.toastService.warn('Valor inválido', 'Por favor ingrese un número válido mayor a 0');
      return;
    }

    // Actualizar la tasa en el servicio
    const exchangeRates = this.exchangeRateService.getRatesInfo();
    if (exchangeRates) {
      const originalRate = exchangeRates.rates[rate.code];

      // Si estamos editando una tasa "from USD", actualizar directamente
      if (this.preferredCurrency === 'USD') {
        exchangeRates.rates[rate.code] = rate.editValue;
      } else {
        // Si estamos editando una tasa hacia otra moneda, calcular la equivalencia en USD
        // Por ejemplo: si editamos 1 USD = 850 ARS, guardamos ARS: 850
        if (rate.code === 'USD') {
          // Estamos editando cuánto vale 1 USD en la moneda preferida
          // Necesitamos actualizar la tasa de la moneda preferida en relación a USD
          const rateFromUsd = rate.editValue;
          exchangeRates.rates[this.preferredCurrency] = rateFromUsd;
        } else {
          // Para otras monedas, calcular la conversión vía USD
          const usdToPreferred = exchangeRates.rates[this.preferredCurrency] || 1;
          const currencyToUsd = rate.editValue / usdToPreferred;
          exchangeRates.rates[rate.code] = 1 / currencyToUsd;
        }
      }

      console.log(`💾 [CurrencyRatesWidget] Tasa actualizada:`, {
        currency: rate.code,
        oldRate: originalRate,
        newRate: rate.editValue,
        preferredCurrency: this.preferredCurrency,
        base: exchangeRates.base
      });

      localStorage.setItem('budget_exchange_rates', JSON.stringify(exchangeRates));

      // Recargar datos
      rate.rate = rate.editValue;
      rate.isEditing = false;
      this.loadData();
    }
  }
}
