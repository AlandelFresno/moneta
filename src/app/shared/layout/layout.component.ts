import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { BudgetAlertService } from '../../services/budget-alert.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss'
})
export class LayoutComponent {
  readonly sidebarOpen = signal(false);

  /** Injected only to instantiate the app-wide budget threshold watcher. */
  constructor(private readonly budgetAlertService: BudgetAlertService) {}
}
