import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { BudgetService } from '../../core/services/budget.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, CardModule, ButtonModule],
  template: `
    <div class="p-4">
      <h1 class="text-3xl font-bold mb-6">Budget Tracker Dashboard</h1>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <p-card>
          <div class="text-center">
            <i class="pi pi-wallet text-4xl text-green-500 mb-2"></i>
            <h3 class="text-lg font-semibold text-gray-600">Total Income</h3>
            <p class="text-3xl font-bold text-green-600">
              \${{ budgetService.getTotalIncome().toFixed(2) }}
            </p>
          </div>
        </p-card>

        <p-card>
          <div class="text-center">
            <i class="pi pi-shopping-cart text-4xl text-red-500 mb-2"></i>
            <h3 class="text-lg font-semibold text-gray-600">Total Expenses</h3>
            <p class="text-3xl font-bold text-red-600">
              \${{ budgetService.getTotalExpenses().toFixed(2) }}
            </p>
          </div>
        </p-card>

        <p-card>
          <div class="text-center">
            <i class="pi pi-chart-line text-4xl text-blue-500 mb-2"></i>
            <h3 class="text-lg font-semibold text-gray-600">Balance</h3>
            <p class="text-3xl font-bold"
               [class.text-green-600]="budgetService.getBalance() >= 0"
               [class.text-red-600]="budgetService.getBalance() < 0">
              \${{ budgetService.getBalance().toFixed(2) }}
            </p>
          </div>
        </p-card>
      </div>

      <p-card>
        <div class="text-center py-8">
          <i class="pi pi-inbox text-6xl text-gray-300 mb-4"></i>
          <h3 class="text-xl font-semibold text-gray-600 mb-2">Welcome to Budget Tracker</h3>
          <p class="text-gray-500 mb-4">Start tracking your finances by adding transactions</p>
          <p-button label="Add Transaction" icon="pi pi-plus" />
        </div>
      </p-card>
    </div>
  `
})
export class DashboardComponent {
  budgetService = inject(BudgetService);
}
