import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

// PrimeNG Modules
import { ButtonModule } from 'primeng/button';

// Chart Modules
import { BaseChartDirective } from 'ng2-charts';

// Page Component
import { AnalyticsPage } from './analytics.page';

// Shared Module
import { SharedModule } from '../../components/shared.module';

const routes: Routes = [
  {
    path: '',
    component: AnalyticsPage
  }
];

@NgModule({
  declarations: [
    AnalyticsPage
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes),
    ButtonModule,
    BaseChartDirective,
    SharedModule
  ]
})
export class AnalyticsModule { }
