import { Component, signal, OnInit } from '@angular/core';
import { ExchangeRateService } from '../services/exchange-rate.service';
import { PreferencesService } from '../services/preferences.service';
import { DataMigrationService } from '../services/data-migration.service';

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
    private preferencesService: PreferencesService,
    private dataMigrationService: DataMigrationService
  ) {}

  ngOnInit(): void {
    // Ejecutar migraciones primero, luego inicializar tasas
    this.initializeApp();
  }

  private async initializeApp(): Promise<void> {
    try {
      // 1. Ejecutar migraciones de datos
      console.log('=== Iniciando migraciones de datos ===');
      await this.dataMigrationService.runMigrations();

      // 2. Inicializar tasas de cambio
      console.log('=== Inicializando tasas de cambio ===');
      await this.initializeExchangeRates();

      console.log('=== Aplicación inicializada correctamente ===');
    } catch (error) {
      console.error('Error inicializando la aplicación:', error);
    }
  }

  private async initializeExchangeRates(): Promise<void> {
    try {
      const cacheInfo = this.exchangeRateService.getCacheInfo();
      const preferredCurrency = this.preferencesService.getPreferredCurrency();

      // Si el caché está expirado (más de 1 día), intentar actualizar automáticamente
      if (cacheInfo.needsUpdate) {
        console.log('Cache de tasas de cambio expirado, actualizando...');
        try {
          await this.exchangeRateService.getRates(preferredCurrency, true);
          console.log('Tasas de cambio actualizadas automáticamente');
        } catch (error) {
          console.warn('No se pudieron actualizar las tasas de cambio automáticamente:', error);
        }
      }
    } catch (error) {
      console.error('Error inicializando tasas de cambio:', error);
    }
  }
}
