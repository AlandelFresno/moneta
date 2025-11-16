import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

// PrimeNG Modules
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';

// Component
import { BillingPage } from './billing.page';

const routes: Routes = [
  {
    path: '',
    component: BillingPage
  }
];

@NgModule({
  declarations: [BillingPage],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes),
    ButtonModule,
    DialogModule,
    TooltipModule
  ]
})
export class BillingModule { }
