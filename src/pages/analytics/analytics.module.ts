import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';

import { AnalyticsPage } from './analytics.page';
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
    RouterModule.forChild(routes),
    BaseChartDirective,
    SharedModule
  ]
})
export class AnalyticsModule { }
