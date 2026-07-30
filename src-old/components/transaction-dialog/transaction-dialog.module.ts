import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';

import { TransactionDialogComponent } from './transaction-dialog.component';

@NgModule({
  declarations: [TransactionDialogComponent],
  imports: [CommonModule, FormsModule, ButtonModule, DialogModule, TooltipModule],
  exports: [TransactionDialogComponent]
})
export class TransactionDialogModule {}
