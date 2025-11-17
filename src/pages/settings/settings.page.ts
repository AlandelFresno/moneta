import { Component, OnInit } from '@angular/core';
import { ExchangeRateService, CacheInfo, ExchangeRates } from '../../services/exchange-rate.service';
import { PreferencesService } from '../../services/preferences.service';
import { GoogleDriveService } from '../../services/google-drive.service';

interface CurrencyDisplay {
  code: string;
  name: string;
  symbol: string;
  rate: number;
  isEditing: boolean;
  editValue: string;
}

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: false
})
export class SettingsPage implements OnInit {
  preferredCurrency: string = 'ARS';
  dollarType: 'oficial' | 'blue' | 'mep' | 'ccl' | 'mayorista' = 'oficial';
  cacheInfo: CacheInfo | null = null;
  exchangeRates: ExchangeRates | null = null;
  isUpdatingRates = false;
  updateSuccess = false;
  updateError: string | null = null;

  // Para mostrar conversión de ejemplo
  showConversionExample = true;
  exampleAmount = 100;
  exampleFromCurrency = 'USD';
  exampleToCurrency = 'ARS';
  exampleResult = 0;

  // Tasas de cambio para mostrar
  currencyRates: CurrencyDisplay[] = [];

  // Google Drive credentials
  googleClientId: string = '';
  googleApiKey: string = '';
  googleSaveSuccess = false;
  googleSaveError: string | null = null;

  currencies = [
    { code: 'ARS', symbol: '$', name: 'Peso Argentino' },
    { code: 'USD', symbol: 'US$', name: 'Dólar Estadounidense' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'BRL', symbol: 'R$', name: 'Real Brasileño' },
    { code: 'GBP', symbol: '£', name: 'Libra Esterlina' },
    { code: 'JPY', symbol: '¥', name: 'Yen Japonés' },
    { code: 'CNY', symbol: '¥', name: 'Yuan Chino' },
    { code: 'MXN', symbol: '$', name: 'Peso Mexicano' },
    { code: 'CLP', symbol: '$', name: 'Peso Chileno' },
    { code: 'UYU', symbol: '$', name: 'Peso Uruguayo' }
  ];

  constructor(
    public exchangeRateService: ExchangeRateService,
    private preferencesService: PreferencesService,
    private googleDriveService: GoogleDriveService
  ) {}

  ngOnInit(): void {
    this.loadSettings();
    this.updateCacheInfo();
    this.loadExchangeRates();
    this.calculateExampleConversion();
    this.loadGoogleCredentials();
  }

  loadSettings(): void {
    this.preferredCurrency = this.preferencesService.getPreferredCurrency();
    this.dollarType = this.preferencesService.getDollarType();
  }

  loadGoogleCredentials(): void {
    const config = localStorage.getItem('google_drive_config');
    if (config) {
      try {
        const { clientId, apiKey } = JSON.parse(config);
        this.googleClientId = clientId || '';
        this.googleApiKey = apiKey || '';
      } catch (error) {
        console.error('❌ [Settings] Error loading Google credentials:', error);
      }
    }
  }

  saveGoogleCredentials(): void {
    console.log('💾 [Settings] Guardando credenciales de Google Drive...');
    this.googleSaveSuccess = false;
    this.googleSaveError = null;

    try {
      // Validar que ambas credenciales estén presentes
      if (!this.googleClientId || !this.googleApiKey) {
        this.googleSaveError = 'Por favor ingresa ambas credenciales (Client ID y API Key)';
        setTimeout(() => this.googleSaveError = null, 5000);
        return;
      }

      // Validar formato básico del Client ID
      if (!this.googleClientId.includes('.apps.googleusercontent.com')) {
        this.googleSaveError = 'El Client ID debe terminar en .apps.googleusercontent.com';
        setTimeout(() => this.googleSaveError = null, 5000);
        return;
      }

      // Validar formato básico de la API Key
      if (!this.googleApiKey.startsWith('AIza')) {
        this.googleSaveError = 'La API Key debe comenzar con "AIza"';
        setTimeout(() => this.googleSaveError = null, 5000);
        return;
      }

      // Guardar usando el servicio de Google Drive
      this.googleDriveService.saveGoogleDriveConfig(this.googleClientId, this.googleApiKey);

      this.googleSaveSuccess = true;
      console.log('✅ [Settings] Credenciales guardadas exitosamente');

      // Ocultar mensaje de éxito después de 3 segundos
      setTimeout(() => {
        this.googleSaveSuccess = false;
      }, 3000);
    } catch (error) {
      this.googleSaveError = 'Error al guardar las credenciales. Por favor, intenta de nuevo.';
      console.error('❌ [Settings] Error saving Google credentials:', error);

      setTimeout(() => {
        this.googleSaveError = null;
      }, 5000);
    }
  }

  clearGoogleCredentials(): void {
    if (confirm('¿Estás seguro de que deseas eliminar las credenciales de Google Drive?')) {
      localStorage.removeItem('google_drive_config');
      this.googleClientId = '';
      this.googleApiKey = '';
      this.googleDriveService.saveGoogleDriveConfig('', '');
      console.log('🗑️ [Settings] Credenciales de Google Drive eliminadas');
    }
  }

  loadExchangeRates(): void {
    this.exchangeRates = this.exchangeRateService.getRatesInfo();
    this.buildCurrencyRatesList();
  }

  buildCurrencyRatesList(): void {
    if (!this.exchangeRates) {
      this.currencyRates = [];
      return;
    }

    this.currencyRates = this.currencies.map(currency => {
      const rate = this.exchangeRateService.getExchangeRate(this.exchangeRates!.base, currency.code);
      return {
        code: currency.code,
        name: currency.name,
        symbol: currency.symbol,
        rate: rate,
        isEditing: false,
        editValue: rate.toFixed(6)
      };
    });
  }

  updateCacheInfo(): void {
    this.cacheInfo = this.exchangeRateService.getCacheInfo();
  }

  onPreferredCurrencyChange(): void {
    this.preferencesService.setPreferredCurrency(this.preferredCurrency);
    this.exampleToCurrency = this.preferredCurrency;
    this.calculateExampleConversion();
  }

  onDollarTypeChange(): void {
    console.log('💱 [Settings] Cambiando tipo de dólar a:', this.dollarType);
    this.preferencesService.setDollarType(this.dollarType);
  }

  calculateExampleConversion(): void {
    if (!this.exchangeRates) {
      this.exampleResult = 0;
      return;
    }

    const fromRate = this.exchangeRateService.getExchangeRate('USD', this.exampleFromCurrency);
    const toRate = this.exchangeRateService.getExchangeRate('USD', this.exampleToCurrency);

    // Convertir desde moneda de ejemplo a USD, luego a moneda destino
    const amountInUSD = this.exampleAmount / fromRate;
    this.exampleResult = amountInUSD * toRate;
  }

  onExampleAmountChange(): void {
    this.calculateExampleConversion();
  }

  onExampleFromCurrencyChange(): void {
    this.calculateExampleConversion();
  }

  onExampleToCurrencyChange(): void {
    this.calculateExampleConversion();
  }

  startEditRate(currency: CurrencyDisplay): void {
    currency.isEditing = true;
    currency.editValue = currency.rate.toFixed(6);
  }

  cancelEditRate(currency: CurrencyDisplay): void {
    currency.isEditing = false;
  }

  saveEditRate(currency: CurrencyDisplay): void {
    console.log(`✏️ [Settings] Guardando tasa editada: ${currency.code} = ${currency.editValue}`);

    const newRate = parseFloat(currency.editValue);

    if (isNaN(newRate) || newRate <= 0) {
      console.warn('⚠️ [Settings] Valor inválido');
      alert('Por favor ingrese un número válido mayor a 0');
      return;
    }

    // Actualizar la tasa manualmente en el servicio
    if (this.exchangeRates) {
      const oldRate = this.exchangeRates.rates[currency.code];
      this.exchangeRates.rates[currency.code] = newRate;
      localStorage.setItem('budget_exchange_rates', JSON.stringify(this.exchangeRates));

      console.log(`💾 [Settings] Tasa actualizada:`, {
        currency: currency.code,
        oldRate: oldRate,
        newRate: newRate,
        base: this.exchangeRates.base
      });
    }

    currency.rate = newRate;
    currency.isEditing = false;

    this.calculateExampleConversion();
  }

  getCacheStatusClass(): string {
    if (!this.cacheInfo) return 'expired';
    return this.cacheInfo.age;
  }

  getCacheStatusText(): string {
    if (!this.cacheInfo) return 'No hay tasas de cambio';

    switch (this.cacheInfo.age) {
      case 'today':
        return 'Tasas actualizadas hoy';
      case 'yesterday':
        return 'Tasas de ayer (válidas)';
      case 'expired':
        return 'Tasas expiradas - actualización requerida';
      default:
        return 'Estado desconocido';
    }
  }

  getCacheStatusIcon(): string {
    if (!this.cacheInfo) return 'pi-exclamation-circle';

    switch (this.cacheInfo.age) {
      case 'today':
        return 'pi-check-circle';
      case 'yesterday':
        return 'pi-info-circle';
      case 'expired':
        return 'pi-exclamation-triangle';
      default:
        return 'pi-question-circle';
    }
  }

  formatLastUpdateDate(): string {
    if (!this.cacheInfo || !this.cacheInfo.lastUpdate) {
      return 'Nunca';
    }

    return new Intl.DateTimeFormat('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(this.cacheInfo.lastUpdate);
  }

  async updateExchangeRates(): Promise<void> {
    console.log('🔄 [Settings] Actualizando tasas de cambio desde API...');
    this.isUpdatingRates = true;
    this.updateSuccess = false;
    this.updateError = null;

    try {
      await this.exchangeRateService.updateRatesManually('USD');
      this.loadExchangeRates();
      this.updateCacheInfo();
      this.calculateExampleConversion();
      this.updateSuccess = true;

      console.log('✅ [Settings] Tasas actualizadas exitosamente');

      // Ocultar mensaje de éxito después de 3 segundos
      setTimeout(() => {
        this.updateSuccess = false;
      }, 3000);
    } catch (error) {
      this.updateError = 'Error al actualizar las tasas de cambio. Por favor, intenta de nuevo.';
      console.error('❌ [Settings] Error updating exchange rates:', error);

      // Ocultar mensaje de error después de 5 segundos
      setTimeout(() => {
        this.updateError = null;
      }, 5000);
    } finally {
      this.isUpdatingRates = false;
    }
  }

  formatCurrency(amount: number, currencyCode: string): string {
    const currency = this.currencies.find(c => c.code === currencyCode);
    return `${currency?.symbol || ''}${amount.toFixed(2)}`;
  }
}
