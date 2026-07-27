import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';

import { FuelPage } from './fuel.page';

const routes: Routes = [
  {
    path: '',
    component: FuelPage
  }
];

@NgModule({
  declarations: [
    FuelPage
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes),
    ButtonModule,
    TooltipModule,
    DialogModule
  ]
})
export class FuelModule { }
