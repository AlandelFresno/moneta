import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'transactions',
    pathMatch: 'full'
  },
  {
    path: 'transactions',
    loadComponent: () => import('./pages/transactions/transactions.page').then((m) => m.TransactionsPage)
  }
];
