import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';

import { ConfirmationDialogComponent } from './confirmation-dialog/confirmation-dialog.component';

@NgModule({
  declarations: [ConfirmationDialogComponent],
  imports: [CommonModule, DialogModule, ButtonModule],
  exports: [ConfirmationDialogComponent]
})
export class RootSharedModule {}
