import Chart from 'chart.js/auto';
import { ThemeColors } from '../../theme.tokens';
import { CategoryBreakdownEntry, CategoryTrend, MonthlyTotals, NetWorthPoint, WeekdaySpend } from '../../services/dashboard.service';

export function renderTrendChart(canvas: HTMLCanvasElement, trend: MonthlyTotals[], colors: ThemeColors): Chart {
  const pointRadius = trend.length > 15 ? 0 : 4;

  return new Chart(canvas, {
    type: 'line',
    data: {
      labels: trend.map((m) => m.monthLabel),
      datasets: [
        {
          label: 'Ingresos',
          data: trend.map((m) => m.income),
          borderColor: colors.income,
          backgroundColor: `${colors.income}1a`,
          borderWidth: 2,
          pointRadius,
          pointHoverRadius: 4,
          pointBackgroundColor: colors.income,
          pointBorderColor: colors.surfaceCard,
          pointBorderWidth: 2,
          fill: true,
          tension: 0.3
        },
        {
          label: 'Gastos',
          data: trend.map((m) => m.expense),
          borderColor: colors.expense,
          backgroundColor: `${colors.expense}1a`,
          borderWidth: 2,
          pointRadius,
          pointHoverRadius: 4,
          pointBackgroundColor: colors.expense,
          pointBorderColor: colors.surfaceCard,
          pointBorderWidth: 2,
          fill: true,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: { color: colors.textSecondary, usePointStyle: true, boxWidth: 8 }
        },
        tooltip: {
          backgroundColor: colors.surfaceCard,
          titleColor: colors.textPrimary,
          bodyColor: colors.textPrimary,
          borderColor: colors.borderSubtle,
          borderWidth: 1,
          padding: 10
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: colors.textSecondary }
        },
        y: {
          grid: { color: colors.borderSubtle },
          ticks: { color: colors.textSecondary },
          beginAtZero: true
        }
      }
    }
  });
}

export function renderNetWorthChart(canvas: HTMLCanvasElement, trend: NetWorthPoint[], colors: ThemeColors): Chart {
  const pointRadius = trend.length > 15 ? 0 : 4;

  return new Chart(canvas, {
    type: 'line',
    data: {
      labels: trend.map((p) => p.label),
      datasets: [
        {
          label: 'Patrimonio neto',
          data: trend.map((p) => p.netWorth),
          borderColor: colors.accent,
          backgroundColor: `${colors.accent}1a`,
          borderWidth: 2,
          pointRadius,
          pointHoverRadius: 4,
          pointBackgroundColor: colors.accent,
          pointBorderColor: colors.surfaceCard,
          pointBorderWidth: 2,
          fill: true,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: colors.surfaceCard,
          titleColor: colors.textPrimary,
          bodyColor: colors.textPrimary,
          borderColor: colors.borderSubtle,
          borderWidth: 1,
          padding: 10
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: colors.textSecondary }
        },
        y: {
          grid: { color: colors.borderSubtle },
          ticks: { color: colors.textSecondary }
        }
      }
    }
  });
}

export function renderCategoryBreakdownChart(canvas: HTMLCanvasElement, entries: CategoryBreakdownEntry[], colors: ThemeColors): Chart {
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: entries.map((b) => b.categoryName),
      datasets: [
        {
          data: entries.map((b) => b.total),
          backgroundColor: entries.map((b) => b.categoryColor),
          borderRadius: 4,
          barThickness: 20
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: colors.surfaceCard,
          titleColor: colors.textPrimary,
          bodyColor: colors.textPrimary,
          borderColor: colors.borderSubtle,
          borderWidth: 1,
          padding: 10
        }
      },
      scales: {
        x: {
          grid: { color: colors.borderSubtle },
          ticks: { color: colors.textSecondary },
          beginAtZero: true
        },
        y: {
          grid: { display: false },
          ticks: { color: colors.textPrimary }
        }
      }
    }
  });
}

export function renderCategoryTrendChart(canvas: HTMLCanvasElement, trend: CategoryTrend, colors: ThemeColors): Chart {
  return new Chart(canvas, {
    type: 'line',
    data: {
      labels: trend.monthLabels,
      datasets: trend.series.map((s) => ({
        label: s.categoryName,
        data: s.totals,
        borderColor: s.categoryColor,
        backgroundColor: `${s.categoryColor}1a`,
        borderWidth: 2,
        pointRadius: trend.monthLabels.length > 15 ? 0 : 3,
        pointHoverRadius: 4,
        pointBackgroundColor: s.categoryColor,
        tension: 0.3
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: { color: colors.textSecondary, usePointStyle: true, boxWidth: 8 }
        },
        tooltip: {
          backgroundColor: colors.surfaceCard,
          titleColor: colors.textPrimary,
          bodyColor: colors.textPrimary,
          borderColor: colors.borderSubtle,
          borderWidth: 1,
          padding: 10
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: colors.textSecondary }
        },
        y: {
          grid: { color: colors.borderSubtle },
          ticks: { color: colors.textSecondary },
          beginAtZero: true
        }
      }
    }
  });
}

export function renderWeekdayChart(canvas: HTMLCanvasElement, weekdaySpend: WeekdaySpend[], colors: ThemeColors): Chart {
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: weekdaySpend.map((w) => w.weekdayLabel),
      datasets: [
        {
          data: weekdaySpend.map((w) => w.total),
          backgroundColor: colors.expense,
          borderRadius: 4,
          barThickness: 28
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: colors.surfaceCard,
          titleColor: colors.textPrimary,
          bodyColor: colors.textPrimary,
          borderColor: colors.borderSubtle,
          borderWidth: 1,
          padding: 10
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: colors.textSecondary }
        },
        y: {
          grid: { color: colors.borderSubtle },
          ticks: { color: colors.textSecondary },
          beginAtZero: true
        }
      }
    }
  });
}
