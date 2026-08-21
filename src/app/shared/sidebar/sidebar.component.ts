import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ThemeService } from '../../services/theme.service';

interface MenuItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, ButtonModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  @Input() open = false;
  @Output() closeRequested = new EventEmitter<void>();

  readonly menuItems: MenuItem[] = [
    { label: 'Dashboard', icon: 'home', route: '/dashboard' },
    { label: 'Cuentas', icon: 'credit-card', route: '/accounts' },
    { label: 'Transacciones', icon: 'list', route: '/transactions' },
    { label: 'Categorías', icon: 'tags', route: '/categories' },
    { label: 'Servicios', icon: 'calendar-clock', route: '/bills' },
    { label: 'Presupuesto', icon: 'wallet', route: '/budgets' },
    { label: 'Sincronización', icon: 'cloud', route: '/sync' }
  ];

  constructor(readonly themeService: ThemeService) {}

  toggleTheme(): void {
    this.themeService.toggle();
  }
}
