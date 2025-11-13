import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

// PrimeNG Modules
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { CalendarModule } from 'primeng/calendar';

// Chart Modules
import { BaseChartDirective } from 'ng2-charts';

// Shared Modules
import { SharedModule } from '../components/shared.module';

// Page Components
import { DashboardPage } from './dashboard/dashboard.page';
import { TransactionsPage } from './transactions/transactions.page';
import { CategoriesPage } from './categories/categories.page';
import { SettingsPage } from './settings/settings.page';
import { BudgetsPage } from './budgets/budgets.page';
import { AnalyticsPage } from './analytics/analytics.page';

const routes: Routes = [
  {
    path: 'dashboard',
    component: DashboardPage
  },
  {
    path: 'transactions',
    component: TransactionsPage
  },
  {
    path: 'categories',
    component: CategoriesPage
  },
  {
    path: 'settings',
    component: SettingsPage
  },
  {
    path: 'budgets',
    component: BudgetsPage
  },
  {
    path: 'analytics',
    component: AnalyticsPage
  }
];

@NgModule({
  declarations: [
    DashboardPage,
    TransactionsPage,
    CategoriesPage,
    SettingsPage,
    BudgetsPage,
    AnalyticsPage
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes),
    ButtonModule,
    DialogModule,
    InputTextModule,
    TooltipModule,
    CalendarModule,
    BaseChartDirective,
    SharedModule
  ]
})
export class PagesModule { }
