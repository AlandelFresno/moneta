import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { ButtonModule } from 'primeng/button';

import { DashboardPage } from './dashboard.page';

const routes: Routes = [
  {
    path: '',
    component: DashboardPage
  }
];

@NgModule({
  declarations: [
    DashboardPage
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    ButtonModule
  ]
})
export class DashboardModule { }
