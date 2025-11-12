import { Component, signal, OnInit } from '@angular/core';
import { ExchangeRateService } from '../services/exchange-rate.service';
import { PreferencesService } from '../services/preferences.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
  standalone: false
})
export class App implements OnInit {
  protected readonly title = signal('budget-tracker');

  constructor(
    private exchangeRateService: ExchangeRateService,
    private preferencesService: PreferencesService
  ) {}

  ngOnInit(): void {
    // Inicializar tasas de cambio al iniciar la aplicación
    this.initializeExchangeRates();
  }

  private async initializeExchangeRates(): Promise<void> {
    try {
      const cacheInfo = this.exchangeRateService.getCacheInfo();
      const preferredCurrency = this.preferencesService.getPreferredCurrency();

      // Si el caché está expirado (más de 1 día), intentar actualizar automáticamente
      if (cacheInfo.needsUpdate) {
        console.log('Cache de tasas de cambio expirado, actualizando...');
        try {
          await this.exchangeRateService.getRates(preferredCurrency, false);
          console.log('Tasas de cambio actualizadas automáticamente');
        } catch (error) {
          console.warn('No se pudieron actualizar las tasas de cambio automáticamente:', error);
        }
      } else {
        // Si el caché es válido, cargarlo
        console.log('Tasas de cambio válidas en caché');
        await this.exchangeRateService.getRates(preferredCurrency, false);
      }
    } catch (error) {
      console.error('Error inicializando tasas de cambio:', error);
    }
  }
}
