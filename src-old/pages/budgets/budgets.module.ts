import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

// PrimeNG
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';

import { BudgetsPage } from './budgets.page';

const routes: Routes = [
  {
    path: '',
    component: BudgetsPage
  }
];

@NgModule({
  declarations: [
    BudgetsPage
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes),
    ButtonModule,
    DialogModule,
    TooltipModule,
    InputTextModule
  ]
})
export class BudgetsModule { }
