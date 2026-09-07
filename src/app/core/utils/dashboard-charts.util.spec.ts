import {
  renderTrendChart,
  renderNetWorthChart,
  renderCategoryBreakdownChart,
  renderCategoryTrendChart,
  renderWeekdayChart
} from './dashboard-charts.util';
import { palette } from '../../theme.tokens';

const COLORS = palette.light;

function canvas(): HTMLCanvasElement {
  return document.createElement('canvas');
}

describe('renderTrendChart', () => {
  it('plots income and expense as two line datasets labeled by month', () => {
    const trend = [
      { monthLabel: 'Ene', income: 1000, expense: 400 },
      { monthLabel: 'Feb', income: 1200, expense: 600 }
    ];

    const chart = renderTrendChart(canvas(), trend, COLORS);
    try {
      expect((chart.config as { type: string }).type).toBe('line');
      expect(chart.data.labels).toEqual(['Ene', 'Feb']);
      expect(chart.data.datasets.length).toBe(2);
      expect(chart.data.datasets[0].data).toEqual([1000, 1200]);
      expect(chart.data.datasets[1].data).toEqual([400, 600]);
    } finally {
      chart.destroy();
    }
  });
});

describe('renderNetWorthChart', () => {
  it('plots a single net-worth line labeled by period', () => {
    const trend = [
      { label: 'Ene', netWorth: 5000 },
      { label: 'Feb', netWorth: 5500 }
    ];

    const chart = renderNetWorthChart(canvas(), trend, COLORS);
    try {
      expect((chart.config as { type: string }).type).toBe('line');
      expect(chart.data.labels).toEqual(['Ene', 'Feb']);
      expect(chart.data.datasets.length).toBe(1);
      expect(chart.data.datasets[0].data).toEqual([5000, 5500]);
    } finally {
      chart.destroy();
    }
  });
});

describe('renderCategoryBreakdownChart', () => {
  it('plots one horizontal bar per category, colored by category color', () => {
    const entries = [
      { categoryId: 'cat-1', categoryName: 'Almacén', categoryColor: '#f00', total: 300 },
      { categoryId: 'cat-2', categoryName: 'Ocio', categoryColor: '#00f', total: 150 }
    ];

    const chart = renderCategoryBreakdownChart(canvas(), entries, COLORS);
    try {
      expect((chart.config as { type: string }).type).toBe('bar');
      expect(chart.data.labels).toEqual(['Almacén', 'Ocio']);
      expect(chart.data.datasets[0].data).toEqual([300, 150]);
      expect(chart.data.datasets[0].backgroundColor).toEqual(['#f00', '#00f']);
    } finally {
      chart.destroy();
    }
  });
});

describe('renderCategoryTrendChart', () => {
  it('plots one line per top category', () => {
    const trend = {
      monthLabels: ['Ene', 'Feb'],
      series: [
        { categoryId: 'cat-1', categoryName: 'Almacén', categoryColor: '#f00', totals: [100, 200] },
        { categoryId: 'cat-2', categoryName: 'Ocio', categoryColor: '#00f', totals: [50, 75] }
      ]
    };

    const chart = renderCategoryTrendChart(canvas(), trend, COLORS);
    try {
      expect((chart.config as { type: string }).type).toBe('line');
      expect(chart.data.labels).toEqual(['Ene', 'Feb']);
      expect(chart.data.datasets.length).toBe(2);
      expect(chart.data.datasets[0].label).toBe('Almacén');
      expect(chart.data.datasets[1].data).toEqual([50, 75]);
    } finally {
      chart.destroy();
    }
  });
});

describe('renderWeekdayChart', () => {
  it('plots one bar per weekday, all in the expense color', () => {
    const weekdaySpend = [
      { weekdayLabel: 'Lun', total: 100 },
      { weekdayLabel: 'Mar', total: 200 }
    ];

    const chart = renderWeekdayChart(canvas(), weekdaySpend, COLORS);
    try {
      expect((chart.config as { type: string }).type).toBe('bar');
      expect(chart.data.labels).toEqual(['Lun', 'Mar']);
      expect(chart.data.datasets[0].data).toEqual([100, 200]);
      expect(chart.data.datasets[0].backgroundColor).toBe(COLORS.expense);
    } finally {
      chart.destroy();
    }
  });
});
