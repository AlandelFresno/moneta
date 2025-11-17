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
    private googleDriveService: GoogleDriveService
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
        alert(result.message);
      } else {
        console.warn('⚠️ [Sidebar] No se pudo exportar:', result.message);
        alert(result.message);
      }
    } catch (error) {
      console.error('❌ [Sidebar] Error en exportación:', error);
      alert('Error al exportar los datos. Por favor, revisa la consola para más detalles.');
    }
  }

  async exportToGoogleDrive() {
    console.log('☁️ [Sidebar] Iniciando exportación a Google Drive...');

    try {
      if (!this.googleDriveService.hasCredentials()) {
        alert('Por favor, configura las credenciales de Google Drive en Configuración primero.');
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
        console.log('✅ [Sidebar] Exportación a Google Drive completada');
        const message = result.webViewLink
          ? `${result.message}\n\n¿Quieres abrir el archivo en Drive?`
          : result.message;

        if (result.webViewLink && confirm(message)) {
          window.open(result.webViewLink, '_blank');
        } else {
          alert(result.message);
        }
      } else {
        console.warn('⚠️ [Sidebar] No se pudo exportar a Google Drive:', result.message);
        alert(result.message);
      }
    } catch (error: any) {
      console.error('❌ [Sidebar] Error en exportación a Google Drive:', error);
      alert(`Error: ${error.message || 'Error desconocido. Por favor, revisa la consola.'}`);
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
