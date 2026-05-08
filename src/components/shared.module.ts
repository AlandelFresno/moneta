import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

// PrimeNG Modules
import { ButtonModule } from 'primeng/button';
import { AvatarModule } from 'primeng/avatar';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';

// Components
import { SidebarComponent } from './sidebar/sidebar.component';
import { LayoutComponent } from './layout/layout.component';
import { ConfirmationDialogComponent } from './confirmation-dialog/confirmation-dialog.component';
import { TransactionDialogComponent } from './transaction-dialog/transaction-dialog.component';

@NgModule({
  declarations: [
    SidebarComponent,
    LayoutComponent,
    ConfirmationDialogComponent,
    TransactionDialogComponent
  ],
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ButtonModule,
    AvatarModule,
    DialogModule,
    TooltipModule
  ],
  exports: [
    SidebarComponent,
    LayoutComponent,
    ConfirmationDialogComponent,
    TransactionDialogComponent
  ]
})
export class SharedModule { }
