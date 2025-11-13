import { Component, OnInit } from '@angular/core';
import { ExchangeRateService, CacheInfo } from '../../services/exchange-rate.service';
import { PreferencesService } from '../../services/preferences.service';
import { Router } from '@angular/router';

interface CurrencyRate {
  code: string;
  name: string;
  symbol: string;
  rate: number;
  rateToPreferred: number;
}

@Component({
  selector: 'app-currency-rates-widget',
  templateUrl: './currency-rates-widget.component.html',
  styleUrls: ['./currency-rates-widget.component.scss'],
  standalone: false
})
export class CurrencyRatesWidgetComponent implements OnInit {
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
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.preferredCurrency = this.preferencesService.getPreferredCurrency();
    this.cacheInfo = this.exchangeRateService.getCacheInfo();
    this.buildTopRates();
  }

  buildTopRates(): void {
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

        return {
          code: currency.code,
          name: currency.name,
          symbol: currency.symbol,
          rate: rate,
          rateToPreferred: rate
        };
      })
      .filter(r => r !== null) as CurrencyRate[];
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

    this.isLoading = true;
    try {
      await this.exchangeRateService.updateRatesManually('USD');
      this.loadData();
    } catch (error) {
      console.error('Error refreshing rates:', error);
    } finally {
      this.isLoading = false;
    }
  }
}
