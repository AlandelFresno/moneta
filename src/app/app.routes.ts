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
        path: '',
        loadChildren: () => import('../pages/pages.module').then(m => m.PagesModule)
      }
    ]
  }
];
