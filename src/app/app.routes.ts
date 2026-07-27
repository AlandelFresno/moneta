import { Routes } from '@angular/router';
import { LayoutComponent } from './shared/layout/layout.component';

export const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      {
        path: '',
        redirectTo: 'transactions',
        pathMatch: 'full'
      },
      {
        path: 'transactions',
        loadComponent: () => import('./pages/transactions/transactions.page').then((m) => m.TransactionsPage)
      }
    ]
  }
];
