import { Routes } from '@angular/router';
import { LayoutComponent } from '../components/layout/layout.component';

export const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadChildren: () => import('../pages/dashboard/dashboard.module').then(m => m.DashboardModule)
      },
      {
        path: 'transactions',
        loadChildren: () => import('../pages/transactions/transactions.module').then(m => m.TransactionsModule)
      },
      {
        path: 'budgets',
        loadChildren: () => import('../pages/budgets/budgets.module').then(m => m.BudgetsModule)
      },
      {
        path: 'analytics',
        loadChildren: () => import('../pages/analytics/analytics.module').then(m => m.AnalyticsModule)
      },
      {
        path: 'categories',
        loadChildren: () => import('../pages/categories/categories.module').then(m => m.CategoriesModule)
      },
      {
        path: 'settings',
        loadChildren: () => import('../pages/settings/settings.module').then(m => m.SettingsModule)
      },
      {
        path: 'fuel',
        loadChildren: () => import('../pages/fuel/fuel.module').then(m => m.FuelModule)
      }
    ]
  }
];
