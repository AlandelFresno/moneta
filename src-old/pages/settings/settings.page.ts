import { Component, OnInit } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { ExchangeRateService, CacheInfo, ExchangeRates } from '../../services/exchange-rate.service';
import { PreferencesService } from '../../services/preferences.service';
import { GoogleDriveService } from '../../services/google-drive.service';
import { ToastService } from '../../services/toast.service';
import { ExportService } from '../../services/export.service';
import { VehicleService } from '../../services/vehicle.service';
import { FuelLogService } from '../../services/fuel-log.service';
import { TransactionService } from '../../services/transaction.service';
import { CategoryService } from '../../services/category.service';
import { AccountService } from '../../services/account.service';
import { BillingService } from '../../services/billing.service';
import { SyncService } from '../../services/sync.service';

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
  readonly isNativePlatform = Capacitor.isNativePlatform();
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
  exampleFromCurrency = 'ARS';
  exampleToCurrency = 'USD';
  exampleResult = 0;

  // Tasas de cambio para mostrar
  currencyRates: CurrencyDisplay[] = [];

  // Para import/export/backup
  showImportDialog = false;
  pendingImportFile: File | null = null;
  pendingImportEvent: any = null;

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
    private googleDriveService: GoogleDriveService,
    private toastService: ToastService,
    private exportService: ExportService,
    private vehicleService: VehicleService,
    private fuelLogService: FuelLogService,
    private transactionService: TransactionService,
    private categoryService: CategoryService,
    private accountService: AccountService,
    private billingService: BillingService,
    private syncService: SyncService
  ) {}

  ngOnInit(): void {
    this.loadSettings();
    this.updateCacheInfo();
    this.loadExchangeRates();
    this.calculateExampleConversion();
  }

  loadSettings(): void {
    this.preferredCurrency = this.preferencesService.getPreferredCurrency();
    this.dollarType = this.preferencesService.getDollarType();
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

    // Usar la moneda preferida como base para las conversiones, no this.exchangeRates.base
    const baseCurrency = this.preferredCurrency;

    this.currencyRates = this.currencies.map(currency => {
      // Calcular la tasa desde la moneda preferida hacia cada moneda
      const rate = this.exchangeRateService.getExchangeRate(baseCurrency, currency.code);
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
    console.log('💱 [Settings] Cambiando moneda preferida a:', this.preferredCurrency);
    this.preferencesService.setPreferredCurrency(this.preferredCurrency);
    this.exampleToCurrency = this.preferredCurrency;

    // CRÍTICO: Reconstruir la tabla de tasas con la nueva moneda base
    this.buildCurrencyRatesList();

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
      this.toastService.warn('Valor inválido', 'Por favor ingrese un número válido mayor a 0');
      return;
    }

    // Actualizar la tasa manualmente en el servicio
    if (this.exchangeRates) {
      const oldRate = this.exchangeRates.rates[currency.code];
      this.exchangeRates.rates[currency.code] = newRate;

      // Actualizar timestamp para marcar como modificado
      this.exchangeRates.timestamp = Date.now();

      // Guardar en localStorage
      localStorage.setItem('budget_exchange_rates', JSON.stringify(this.exchangeRates));

      console.log(`💾 [Settings] Tasa actualizada:`, {
        currency: currency.code,
        oldRate: oldRate,
        newRate: newRate,
        base: this.exchangeRates.base
      });

      // CRÍTICO: Notificar al servicio para que actualice el BehaviorSubject
      // Esto asegura que todos los componentes que están suscritos se enteren del cambio
      (this.exchangeRateService as any).ratesSubject.next(this.exchangeRates);
    }

    currency.rate = newRate;
    currency.isEditing = false;

    // CRÍTICO: Reconstruir toda la tabla para reflejar los cambios en todas las conversiones
    this.buildCurrencyRatesList();

    // Recalcular el ejemplo de conversión
    this.calculateExampleConversion();

    this.toastService.success('Tasa actualizada', `La tasa de ${currency.code} se actualizó correctamente`);
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

  // Métodos de Importar/Exportar/Backup

  exportAllData() {
    console.log('📤 [Settings] Iniciando exportación de todos los datos...');

    try {
      const transactions = this.transactionService.getTransactions();
      const vehicles = this.vehicleService.getVehicles();
      const fuelLogs = this.fuelLogService.getLogs();
      const categories = this.categoryService.getCategories();
      const accounts = this.accountService.getAccounts();
      const preferences = this.preferencesService.getPreferences();
      const billings = this.billingService.getBillings();

      console.log('📊 [Settings] Datos obtenidos de los servicios:', {
        transactions: transactions.length,
        vehicles: vehicles.length,
        fuelLogs: fuelLogs.length,
        categories: categories.length,
        accounts: accounts.length,
        billings: billings.length,
        preferences: preferences
      });

      const result = this.exportService.exportAllData(
        transactions,
        vehicles,
        fuelLogs,
        categories,
        accounts,
        preferences,
        billings
      );

      if (result.success) {
        console.log('✅ [Settings] Exportación completada exitosamente');
        this.toastService.success('Exportación exitosa', result.message);
      } else {
        console.warn('⚠️ [Settings] No se pudo exportar:', result.message);
        this.toastService.error('Error al exportar', result.message);
      }
    } catch (error) {
      console.error('❌ [Settings] Error en exportación:', error);
      this.toastService.error('Error al exportar', 'Por favor, revisa la consola para más detalles.');
    }
  }

  async exportToGoogleDrive() {
    console.log('☁️ [Settings] Iniciando backup a Google Drive...');

    try {
      if (!this.googleDriveService.hasCredentials()) {
        this.toastService.warn('Credenciales requeridas', 'Por favor, configura las credenciales de Google Drive en google-drive.service.ts');
        return;
      }

      const transactions = this.transactionService.getTransactions();
      const vehicles = this.vehicleService.getVehicles();
      const fuelLogs = this.fuelLogService.getLogs();
      const categories = this.categoryService.getCategories();
      const accounts = this.accountService.getAccounts();
      const preferences = this.preferencesService.getPreferences();
      const billings = this.billingService.getBillings();

      console.log('📊 [Settings] Datos obtenidos de los servicios para backup:', {
        transactions: transactions.length,
        vehicles: vehicles.length,
        fuelLogs: fuelLogs.length,
        categories: categories.length,
        accounts: accounts.length,
        billings: billings.length,
        preferences: preferences
      });

      const result = await this.exportService.exportAllDataToGoogleDrive(
        transactions,
        vehicles,
        fuelLogs,
        categories,
        accounts,
        preferences,
        billings
      );

      if (result.success) {
        console.log('✅ [Settings] Backup a Google Drive completado');

        if (result.webViewLink) {
          this.toastService.success('Backup completado', result.message);
          window.open(result.webViewLink, '_blank');
        } else {
          this.toastService.success('Backup completado', result.message);
        }
      } else {
        console.warn('⚠️ [Settings] No se pudo hacer backup a Google Drive:', result.message);
        this.toastService.error('Error en backup', result.message);
      }
    } catch (error: any) {
      console.error('❌ [Settings] Error en backup a Google Drive:', error);
      this.toastService.error('Error en backup', error.message || 'Error desconocido. Por favor, revisa la consola.');
    }
  }

  async importFromExcel(event: any) {
    const file = event.target.files[0];
    if (!file) {
      return;
    }

    console.log('📥 [Settings] Iniciando importación desde Excel...');

    try {
      this.pendingImportFile = file;
      this.pendingImportEvent = event;
      this.showImportDialog = true;
    } catch (error: any) {
      console.error('❌ [Settings] Error en importación:', error);
      this.toastService.error('Error en importación', error.message || 'Error desconocido');
      event.target.value = '';
    }
  }

  closeImportDialog() {
    this.showImportDialog = false;
    if (this.pendingImportEvent) {
      this.pendingImportEvent.target.value = '';
    }
    this.pendingImportFile = null;
    this.pendingImportEvent = null;
  }

  async confirmImport() {
    this.showImportDialog = false;
    if (this.pendingImportFile && this.pendingImportEvent) {
      await this.performImport(this.pendingImportFile, this.pendingImportEvent);
    }
    this.pendingImportFile = null;
    this.pendingImportEvent = null;
  }

  private async performImport(file: File, event: any) {
    try {
      const result = await this.exportService.importAllDataFromExcel(file);

      if (result.success && result.data) {
        console.log('✅ [Settings] Datos importados correctamente');

        // Combinar con datos existentes
        const existingCategories = this.categoryService.getCategories();
        const existingAccounts = this.accountService.getAccounts();
        const existingVehicles = this.vehicleService.getVehicles();
        const existingTransactions = this.transactionService.getTransactions();
        const existingFuelLogs = this.fuelLogService.getLogs();
        const existingBillings = this.billingService.getBillings();

        // Filtrar datos nuevos (que no existan por ID)
        const newCategories = result.data.categories.filter(
          cat => !existingCategories.find(c => c.id === cat.id)
        );
        const newAccounts = result.data.accounts.filter(
          acc => !existingAccounts.find(a => a.id === acc.id)
        );
        const newVehicles = result.data.vehicles.filter(
          veh => !existingVehicles.find(v => v.id === veh.id)
        );
        const newTransactions = result.data.transactions.filter(
          txn => !existingTransactions.find(t => t.id === txn.id)
        );
        const newFuelLogs = result.data.fuelLogs.filter(
          log => !existingFuelLogs.find(l => l.id === log.id)
        );
        const newBillings = result.data.billings.filter(
          bill => !existingBillings.find(b => b.id === bill.id)
        );

        // Guardar datos combinados directamente en localStorage
        if (newCategories.length > 0) {
          localStorage.setItem('budget_categories', JSON.stringify([...existingCategories, ...newCategories]));
        }
        if (newAccounts.length > 0) {
          localStorage.setItem('budget_accounts', JSON.stringify([...existingAccounts, ...newAccounts]));
        }
        if (newVehicles.length > 0) {
          localStorage.setItem('budget_vehicles', JSON.stringify([...existingVehicles, ...newVehicles]));
        }
        if (newTransactions.length > 0) {
          localStorage.setItem('budget_transactions', JSON.stringify([...existingTransactions, ...newTransactions]));
        }
        if (newFuelLogs.length > 0) {
          localStorage.setItem('budget_fuel_logs', JSON.stringify([...existingFuelLogs, ...newFuelLogs]));
        }
        if (newBillings.length > 0) {
          localStorage.setItem('budget_monthly_billing', JSON.stringify([...existingBillings, ...newBillings]));
        }

        // Actualizar preferencias
        if (result.data.preferences) {
          this.preferencesService.setPreferredCurrency(result.data.preferences.preferredCurrency);
        }

        const totalNew = newCategories.length + newAccounts.length + newVehicles.length +
                        newTransactions.length + newFuelLogs.length + newBillings.length;

        this.toastService.success(
          'Importación completada',
          `${totalNew} registros nuevos agregados. La página se recargará en 2 segundos.`,
          6000
        );

        // Recargar la página después de 2 segundos
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        console.warn('⚠️ [Settings] Error en importación:', result.message);
        this.toastService.error('Error en importación', result.message);
      }
    } catch (error: any) {
      console.error('❌ [Settings] Error en importación:', error);
      this.toastService.error('Error en importación', error.message || 'Error desconocido');
    } finally {
      // Limpiar el input file
      event.target.value = '';
    }
  }
}
