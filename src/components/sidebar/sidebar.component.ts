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
      icon: 'file-invoice',
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

      const shouldContinue = await this.toastService.confirm(
        'La sincronización combinará los datos locales con los de Drive. El más reciente prevalecerá. ¿Continuar?',
        'Confirmar sincronización'
      );

      if (!shouldContinue) {
        return;
      }

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
    // Recargar la página para aplicar cambios
    window.location.reload();
  }

  onSecondaryCurrencyChange(): void {
    console.log('💱 [Sidebar] Cambiando moneda secundaria a:', this.secondaryCurrency);
    this.preferencesService.setSecondaryCurrency(this.secondaryCurrency);
    // Recargar la página para aplicar cambios
    window.location.reload();
  }
}
