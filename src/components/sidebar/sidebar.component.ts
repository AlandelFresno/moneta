import { Component, signal } from '@angular/core';
import { ExportService } from '../../services/export.service';
import { VehicleService } from '../../services/vehicle.service';
import { FuelLogService } from '../../services/fuel-log.service';
import { TransactionService } from '../../services/transaction.service';
import { CategoryService } from '../../services/category.service';
import { AccountService } from '../../services/account.service';
import { PreferencesService } from '../../services/preferences.service';
import { BillingService } from '../../services/billing.service';
import { GoogleDriveService } from '../../services/google-drive.service';
import { SyncService } from '../../services/sync.service';
import { ToastService } from '../../services/toast.service';
import { SUPPORTED_CURRENCIES } from '../../constants/currencies';

export interface MenuItem {
  label: string;
  icon: string;
  route: string;
  badge?: string;
}

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
  standalone: false
})
export class SidebarComponent {
  isCollapsed = signal(false);
  isMobileMenuOpen = signal(false);
  currencies = SUPPORTED_CURRENCIES;
  primaryCurrency: string;
  secondaryCurrency: string;
  currentTheme: 'light' | 'dark';

  showSyncDialog = false;
  showImportDialog = false;
  pendingImportFile: File | null = null;
  pendingImportEvent: any = null;

  constructor(
    private exportService: ExportService,
    private vehicleService: VehicleService,
    private fuelLogService: FuelLogService,
    private transactionService: TransactionService,
    private categoryService: CategoryService,
    private accountService: AccountService,
    private preferencesService: PreferencesService,
    private billingService: BillingService,
    private googleDriveService: GoogleDriveService,
    private syncService: SyncService,
    private toastService: ToastService
  ) {
    // Cargar las monedas preferidas
    this.primaryCurrency = this.preferencesService.getPreferredCurrency();
    this.secondaryCurrency = this.preferencesService.getSecondaryCurrency() || 'USD';
    this.currentTheme = this.preferencesService.getTheme();
  }

  menuItems: MenuItem[] = [
    {
      label: 'Dashboard',
      icon: 'home',
      route: '/dashboard'
    },
    {
      label: 'Transactions',
      icon: 'list',
      route: '/transactions'
    },
    {
      label: 'Budgets',
      icon: 'chart-pie',
      route: '/budgets'
    },
    {
      label: 'Analytics',
      icon: 'chart-line',
      route: '/analytics'
    },
    {
      label: 'Categories',
      icon: 'tags',
      route: '/categories'
    },
    {
      label: 'Combustible',
      icon: 'car',
      route: '/fuel'
    },
    {
      label: 'Facturación',
      icon: 'file-edit',
      route: '/billing'
    },
    {
      label: 'Settings',
      icon: 'cog',
      route: '/settings'
    }
  ];

  toggleSidebar() {
    this.isCollapsed.update(v => !v);
  }

  openMobileMenu() {
    this.isMobileMenuOpen.set(true);
  }

  closeMobileMenu() {
    this.isMobileMenuOpen.set(false);
  }

  exportAllData() {
    console.log('📤 [Sidebar] Iniciando exportación de todos los datos...');

    try {
      const transactions = this.transactionService.getTransactions();
      const vehicles = this.vehicleService.getVehicles();
      const fuelLogs = this.fuelLogService.getLogs();
      const categories = this.categoryService.getCategories();
      const accounts = this.accountService.getAccounts();
      const preferences = this.preferencesService.getPreferences();
      const billings = this.billingService.getBillings();

      console.log('📊 [Sidebar] Datos obtenidos de los servicios:', {
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
        console.log('✅ [Sidebar] Exportación completada exitosamente');
        this.toastService.success('Exportación exitosa', result.message);
      } else {
        console.warn('⚠️ [Sidebar] No se pudo exportar:', result.message);
        this.toastService.error('Error al exportar', result.message);
      }
    } catch (error) {
      console.error('❌ [Sidebar] Error en exportación:', error);
      this.toastService.error('Error al exportar', 'Por favor, revisa la consola para más detalles.');
    }
  }

  async exportToGoogleDrive() {
    console.log('☁️ [Sidebar] Iniciando backup a Google Drive...');

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

      console.log('📊 [Sidebar] Datos obtenidos de los servicios para backup:', {
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
        console.log('✅ [Sidebar] Backup a Google Drive completado');

        if (result.webViewLink) {
          this.toastService.success('Backup completado', result.message);
          // Abrir el archivo automáticamente
          window.open(result.webViewLink, '_blank');
        } else {
          this.toastService.success('Backup completado', result.message);
        }
      } else {
        console.warn('⚠️ [Sidebar] No se pudo hacer backup a Google Drive:', result.message);
        this.toastService.error('Error en backup', result.message);
      }
    } catch (error: any) {
      console.error('❌ [Sidebar] Error en backup a Google Drive:', error);
      this.toastService.error('Error en backup', error.message || 'Error desconocido. Por favor, revisa la consola.');
    }
  }

  async syncWithDrive() {
    console.log('🔄 [Sidebar] Iniciando sincronización con Google Drive...');

    try {
      if (!this.googleDriveService.hasCredentials()) {
        this.toastService.warn('Credenciales requeridas', 'Por favor, configura las credenciales de Google Drive en google-drive.service.ts');
        return;
      }

      this.showSyncDialog = true;
    } catch (error: any) {
      console.error('❌ [Sidebar] Error en sincronización:', error);
      this.toastService.error('Error en sincronización', error.message || 'Error desconocido. Por favor, revisa la consola.');
    }
  }

  closeSyncDialog() {
    this.showSyncDialog = false;
  }

  async confirmSync() {
    this.showSyncDialog = false;
    await this.performSync();
  }

  private async performSync() {
    try {
      const result = await this.syncService.sync();

      if (result.success) {
        console.log('✅ [Sidebar] Sincronización completada');

        let details = `📊 Cambios aplicados:\n`;
        details += `• Transacciones: +${result.stats.transactionsAdded} nuevas, ~${result.stats.transactionsUpdated} actualizadas\n`;
        details += `• Vehículos: +${result.stats.vehiclesAdded} nuevos, ~${result.stats.vehiclesUpdated} actualizados\n`;
        details += `• Combustible: +${result.stats.fuelLogsAdded} nuevos, ~${result.stats.fuelLogsUpdated} actualizados\n`;
        details += `• Categorías: +${result.stats.categoriesAdded} nuevas, ~${result.stats.categoriesUpdated} actualizadas\n`;
        details += `• Cuentas: +${result.stats.accountsAdded} nuevas, ~${result.stats.accountsUpdated} actualizadas\n`;
        details += `• Facturaciones: +${result.stats.billingsAdded} nuevas, ~${result.stats.billingsUpdated} actualizadas`;

        this.toastService.success('Sincronización completada', details, 8000);

        // Recargar automáticamente después de 2 segundos
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        console.warn('⚠️ [Sidebar] Error en sincronización:', result.message);
        this.toastService.error('Error en sincronización', result.message);
      }
    } catch (error: any) {
      console.error('❌ [Sidebar] Error en sincronización:', error);
      this.toastService.error('Error en sincronización', error.message || 'Error desconocido. Por favor, revisa la consola.');
    }
  }

  onPrimaryCurrencyChange(): void {
    console.log('💱 [Sidebar] Cambiando moneda principal a:', this.primaryCurrency);
    this.preferencesService.setPreferredCurrency(this.primaryCurrency);

    // Mostrar toast de confirmación
    this.toastService.success(
      'Moneda principal actualizada',
      `Los montos ahora se mostrarán en ${this.primaryCurrency}. Recargando...`,
      2000
    );

    // Recargar la página para que se actualicen todos los componentes
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  }

  onSecondaryCurrencyChange(): void {
    console.log('💱 [Sidebar] Cambiando moneda secundaria a:', this.secondaryCurrency);
    this.preferencesService.setSecondaryCurrency(this.secondaryCurrency);

    // Mostrar toast de confirmación
    this.toastService.success(
      'Moneda de detalle actualizada',
      `Los montos ahora se mostrarán con detalle en ${this.secondaryCurrency}. Recargando...`,
      2000
    );

    // Recargar la página para que se actualicen todos los componentes
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  }

  toggleTheme(): void {
    const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    console.log('🎨 [Sidebar] Cambiando tema a:', newTheme);

    this.currentTheme = newTheme;
    this.preferencesService.setTheme(newTheme);

    // Mostrar toast de confirmación
    this.toastService.success(
      'Tema actualizado',
      `Se aplicó el tema ${newTheme === 'dark' ? 'oscuro' : 'claro'}`,
      1500
    );
  }

  async importFromExcel(event: any) {
    const file = event.target.files[0];
    if (!file) {
      return;
    }

    console.log('📥 [Sidebar] Iniciando importación desde Excel...');

    try {
      this.pendingImportFile = file;
      this.pendingImportEvent = event;
      this.showImportDialog = true;
    } catch (error: any) {
      console.error('❌ [Sidebar] Error en importación:', error);
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
        console.log('✅ [Sidebar] Datos importados correctamente');

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
        console.warn('⚠️ [Sidebar] Error en importación:', result.message);
        this.toastService.error('Error en importación', result.message);
      }
    } catch (error: any) {
      console.error('❌ [Sidebar] Error en importación:', error);
      this.toastService.error('Error en importación', error.message || 'Error desconocido');
    } finally {
      // Limpiar el input file
      event.target.value = '';
    }
  }
}
