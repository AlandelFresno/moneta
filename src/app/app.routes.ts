import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('../components/layout/layout.component').then(m => m.LayoutComponent),
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('../pages/dashboard/dashboard.page').then(m => m.DashboardPage)
      },
      {
        path: 'transactions',
        loadComponent: () => import('../pages/transactions/transactions.page').then(m => m.TransactionsPage)
      },
      {
        path: 'budgets',
        loadComponent: () => import('../pages/budgets/budgets.page').then(m => m.BudgetsPage)
      },
      {
        path: 'analytics',
        loadComponent: () => import('../pages/analytics/analytics.page').then(m => m.AnalyticsPage)
      },
      {
        path: 'categories',
        loadComponent: () => import('../pages/categories/categories.page').then(m => m.CategoriesPage)
      },
      {
        path: 'settings',
        loadComponent: () => import('../pages/settings/settings.page').then(m => m.SettingsPage)
      }
    ]
  }
];
