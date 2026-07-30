import { NgModule } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { ButtonModule } from 'primeng/button';

import { AnalyticsPage } from './analytics.page';
import { SharedModule } from '../../components/shared.module';

const routes: Routes = [{ path: '', component: AnalyticsPage }];

@NgModule({
  declarations: [AnalyticsPage],
  imports: [CommonModule, FormsModule, RouterModule.forChild(routes), ButtonModule, SharedModule],
  providers: [DecimalPipe]
})
export class AnalyticsModule {}
