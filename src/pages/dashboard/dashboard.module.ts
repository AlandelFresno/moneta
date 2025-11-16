import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

import { DashboardPage } from './dashboard.page';
import { CurrencyRatesWidgetComponent } from '../../components/currency-rates-widget/currency-rates-widget.component';

const routes: Routes = [
  {
    path: '',
    component: DashboardPage
  }
];

@NgModule({
  declarations: [
    DashboardPage,
    CurrencyRatesWidgetComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes),
    ButtonModule,
    TooltipModule
  ]
})
export class DashboardModule { }
