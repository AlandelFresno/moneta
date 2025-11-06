import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';

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
    RouterModule.forChild(routes)
  ]
})
export class BudgetsModule { }
