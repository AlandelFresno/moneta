import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

// PrimeNG
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';

import { TransactionsPage } from './transactions.page';
import { SharedModule } from '../../components/shared.module';
import { TransactionDialogModule } from '../../components/transaction-dialog/transaction-dialog.module';

const routes: Routes = [
  {
    path: '',
    component: TransactionsPage
  }
];

@NgModule({
  declarations: [TransactionsPage],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes),
    ButtonModule,
    DialogModule,
    InputTextModule,
    TooltipModule,
    SharedModule,
    TransactionDialogModule
  ]
})
export class TransactionsModule { }
