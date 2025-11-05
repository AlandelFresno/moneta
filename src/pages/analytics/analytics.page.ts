import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface PeriodOption {
  label: string;
  value: string;
}

interface Stats {
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  transactionCount: number;
  incomeChange: number;
  expenseChange: number;
  savingsRate: number;
  avgTransaction: number;
}

interface Category {
  name: string;
  amount: number;
  transactions: number;
  percentage: number;
  color: string;
  icon: string;
}

interface BudgetItem {
  name: string;
  spent: number;
  limit: number;
  percentage: number;
  status: 'success' | 'warning' | 'danger';
  statusText: string;
}

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, CardModule, ButtonModule, ProgressBarModule],
  templateUrl: './analytics.page.html',
  styleUrls: ['./analytics.page.scss']
})
export class AnalyticsPage implements OnInit, AfterViewInit {
  @ViewChild('lineChart') lineChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('doughnutChart') doughnutChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('barChart') barChartRef!: ElementRef<HTMLCanvasElement>;

  selectedPeriod = 'month';

  periods: PeriodOption[] = [
    { label: 'Week', value: 'week' },
    { label: 'Month', value: 'month' },
    { label: '3 Months', value: 'quarter' },
    { label: 'Year', value: 'year' }
  ];

  stats: Stats = {
    totalIncome: 12450.00,
    totalExpenses: 8920.50,
    netSavings: 3529.50,
    transactionCount: 156,
    incomeChange: 12.5,
    expenseChange: 8.3,
    savingsRate: 28.3,
    avgTransaction: 57.18
  };

  topCategories: Category[] = [
    {
      name: 'Housing',
      amount: 2500.00,
      transactions: 12,
      percentage: 85,
      color: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      icon: 'pi pi-home'
    },
    {
      name: 'Transportation',
      amount: 1850.00,
      transactions: 28,
      percentage: 62,
      color: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
      icon: 'pi pi-car'
    },
    {
      name: 'Food & Dining',
      amount: 1420.50,
      transactions: 45,
      percentage: 48,
      color: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      icon: 'pi pi-shopping-cart'
    },
    {
      name: 'Entertainment',
      amount: 890.00,
      transactions: 22,
      percentage: 30,
      color: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      icon: 'pi pi-play'
    },
    {
      name: 'Utilities',
      amount: 650.00,
      transactions: 8,
      percentage: 22,
      color: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      icon: 'pi pi-bolt'
    }
  ];

  budgetProgress: BudgetItem[] = [
    {
      name: 'Housing',
      spent: 2100,
      limit: 2500,
      percentage: 84,
      status: 'warning',
      statusText: 'On Track'
    },
    {
      name: 'Food & Dining',
      spent: 850,
      limit: 1200,
      percentage: 71,
      status: 'success',
      statusText: 'Good'
    },
    {
      name: 'Transportation',
      spent: 580,
      limit: 500,
      percentage: 116,
      status: 'danger',
      statusText: 'Over Budget'
    },
    {
      name: 'Entertainment',
      spent: 340,
      limit: 600,
      percentage: 57,
      status: 'success',
      statusText: 'Good'
    }
  ];

  private lineChart?: Chart;
  private doughnutChart?: Chart;
  private barChart?: Chart;

  ngOnInit(): void {
    // Initialize data
  }

  ngAfterViewInit(): void {
    // Wait a bit for the DOM to be ready
    setTimeout(() => {
      this.createLineChart();
      this.createDoughnutChart();
      this.createBarChart();
    }, 100);
  }

  selectPeriod(period: string): void {
    this.selectedPeriod = period;
    // Here you would normally fetch new data based on the selected period
    this.updateCharts();
  }

  private createLineChart(): void {
    if (!this.lineChartRef) return;

    const ctx = this.lineChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    this.lineChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        datasets: [
          {
            label: 'Income',
            data: [3200, 3500, 3100, 3800, 4200, 3900, 4100, 4500, 4300, 4600, 4400, 4800],
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            tension: 0.4,
            fill: true
          },
          {
            label: 'Expenses',
            data: [2400, 2800, 2600, 2900, 3100, 2700, 2950, 3200, 3000, 3300, 3100, 3400],
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            tension: 0.4,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 20,
              usePointStyle: true
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: '#f3f4f6'
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        }
      }
    });
  }

  private createDoughnutChart(): void {
    if (!this.doughnutChartRef) return;

    const ctx = this.doughnutChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    this.doughnutChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Housing', 'Transportation', 'Food', 'Entertainment', 'Utilities'],
        datasets: [{
          data: [2500, 1850, 1420, 890, 650],
          backgroundColor: [
            '#3b82f6',
            '#8b5cf6',
            '#10b981',
            '#f59e0b',
            '#ef4444'
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 15,
              usePointStyle: true
            }
          }
        }
      }
    });
  }

  private createBarChart(): void {
    if (!this.barChartRef) return;

    const ctx = this.barChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    this.barChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        datasets: [
          {
            label: 'Income',
            data: [4100, 4500, 4300, 4600, 4400, 4800],
            backgroundColor: '#10b981',
            borderRadius: 8
          },
          {
            label: 'Expenses',
            data: [2950, 3200, 3000, 3300, 3100, 3400],
            backgroundColor: '#ef4444',
            borderRadius: 8
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 15,
              usePointStyle: true
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: '#f3f4f6'
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        }
      }
    });
  }

  private updateCharts(): void {
    // Update chart data based on selected period
    // This is where you would fetch new data and update the charts
    console.log('Updating charts for period:', this.selectedPeriod);
  }

  ngOnDestroy(): void {
    // Clean up charts
    if (this.lineChart) this.lineChart.destroy();
    if (this.doughnutChart) this.doughnutChart.destroy();
    if (this.barChart) this.barChart.destroy();
  }
}
