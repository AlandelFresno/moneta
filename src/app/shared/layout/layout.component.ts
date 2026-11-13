import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { BudgetAlertService } from '../../services/budget-alert.service';
import { BillNotificationService } from '../../services/bill-notification.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss'
})
export class LayoutComponent {
  private readonly collapsedKey = 'sidebar_collapsed';
  readonly sidebarOpen = signal(false);
  readonly sidebarCollapsed = signal(localStorage.getItem(this.collapsedKey) === 'true');

  toggleCollapsed(): void {
    const next = !this.sidebarCollapsed();
    this.sidebarCollapsed.set(next);
    localStorage.setItem(this.collapsedKey, String(next));
  }

  /** Injected only to instantiate the app-wide budget threshold and bill-reminder watchers. */
  constructor(
    private readonly budgetAlertService: BudgetAlertService,
    private readonly billNotificationService: BillNotificationService
  ) {}
}
