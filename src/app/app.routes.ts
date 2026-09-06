import { Routes } from '@angular/router';
import { LayoutComponent } from './shared/layout/layout.component';

export const routes: Routes = [
  {
    path: 'welcome',
    loadComponent: () => import('./pages/welcome/welcome.page').then((m) => m.WelcomePage)
  },
  {
    path: 'oauth2redirect',
    loadComponent: () => import('./pages/oauth-redirect/oauth-redirect.page').then((m) => m.OauthRedirectPage)
  },
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
        loadComponent: () => import('./pages/dashboard/dashboard.page').then((m) => m.DashboardPage)
      },
      {
        path: 'accounts',
        loadComponent: () => import('./pages/accounts/accounts.page').then((m) => m.AccountsPage)
      },
      {
        path: 'transactions',
        loadComponent: () => import('./pages/transactions/transactions.page').then((m) => m.TransactionsPage)
      },
      {
        path: 'categories',
        loadComponent: () => import('./pages/categories/categories.page').then((m) => m.CategoriesPage)
      },
      {
        path: 'bills',
        loadComponent: () => import('./pages/bills/bills.page').then((m) => m.BillsPage)
      },
      {
        path: 'budgets',
        loadComponent: () => import('./pages/budgets/budgets.page').then((m) => m.BudgetsPage)
      },
      {
        path: 'goals',
        loadComponent: () => import('./pages/goals/goals.page').then((m) => m.GoalsPage)
      },
      {
        path: 'sync',
        loadComponent: () => import('./pages/sync/sync.page').then((m) => m.SyncPage)
      }
    ]
  }
];
