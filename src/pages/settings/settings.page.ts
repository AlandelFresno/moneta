import { Component, OnInit } from '@angular/core';
import { ExchangeRateService, CacheInfo } from '../../services/exchange-rate.service';
import { PreferencesService } from '../../services/preferences.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: false
})
export class SettingsPage implements OnInit {
  preferredCurrency: string = 'ARS';
  cacheInfo: CacheInfo | null = null;
  isUpdatingRates = false;
  updateSuccess = false;
  updateError: string | null = null;

  currencies = [
    { code: 'ARS', symbol: '$', name: 'Argentine Peso' },
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' }
  ];

  constructor(
    private exchangeRateService: ExchangeRateService,
    private preferencesService: PreferencesService
  ) {}

  ngOnInit(): void {
    this.loadSettings();
    this.updateCacheInfo();
  }

  loadSettings(): void {
    this.preferredCurrency = this.preferencesService.getPreferredCurrency();
  }

  updateCacheInfo(): void {
    this.cacheInfo = this.exchangeRateService.getCacheInfo();
  }

  onPreferredCurrencyChange(): void {
    this.preferencesService.setPreferredCurrency(this.preferredCurrency);
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
    this.isUpdatingRates = true;
    this.updateSuccess = false;
    this.updateError = null;

    try {
      await this.exchangeRateService.updateRatesManually(this.preferredCurrency);
      this.updateCacheInfo();
      this.updateSuccess = true;

      // Ocultar mensaje de éxito después de 3 segundos
      setTimeout(() => {
        this.updateSuccess = false;
      }, 3000);
    } catch (error) {
      this.updateError = 'Error al actualizar las tasas de cambio. Por favor, intenta de nuevo.';
      console.error('Error updating exchange rates:', error);

      // Ocultar mensaje de error después de 5 segundos
      setTimeout(() => {
        this.updateError = null;
      }, 5000);
    } finally {
      this.isUpdatingRates = false;
    }
  }
}
