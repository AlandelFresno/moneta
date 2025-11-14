import { Component, signal } from '@angular/core';
import { ExportService } from '../../services/export.service';
import { VehicleService } from '../../services/vehicle.service';
import { FuelLogService } from '../../services/fuel-log.service';
import { TransactionService } from '../../services/transaction.service';

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

  constructor(
    private exportService: ExportService,
    private vehicleService: VehicleService,
    private fuelLogService: FuelLogService,
    private transactionService: TransactionService
  ) {}

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

    const transactions = this.transactionService.getTransactions();
    const vehicles = this.vehicleService.getVehicles();
    const fuelLogs = this.fuelLogService.getLogs();

    this.exportService.exportAllData(transactions, vehicles, fuelLogs);

    console.log('✅ [Sidebar] Exportación completada');
  }
}
