import { Component, signal } from '@angular/core';

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
}
