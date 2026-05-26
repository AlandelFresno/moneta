import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

import { SidebarComponent } from './sidebar/sidebar.component';
import { LayoutComponent } from './layout/layout.component';

@NgModule({
  declarations: [SidebarComponent, LayoutComponent],
  imports: [CommonModule, RouterModule, FormsModule, ButtonModule, TooltipModule],
  exports: [SidebarComponent, LayoutComponent]
})
export class SharedModule {}
