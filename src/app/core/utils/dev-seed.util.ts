import { StoredCategory } from '../../services/category.service';
import { StoredTransaction } from '../../services/transaction.service';
import { StoredBill } from '../../services/bill.service';

/** Populates localStorage with sample data for local development. No-ops if any domain key already has data. */
export function seedDevDataIfEmpty(): void {
  if (localStorage.getItem('transactions') || localStorage.getItem('categories') || localStorage.getItem('bills')) {
    return;
  }

  const now = new Date();
  const iso = (d: Date): string => d.toISOString();
  const rid = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  const categories: StoredCategory[] = [
    { id: 'seed-income-salario', name: 'Salario', type: 'income', color: '#10b981', icon: 'briefcase', createdAt: iso(now), updatedAt: iso(now) },
    { id: 'seed-income-freelance', name: 'Freelance', type: 'income', color: '#22d3ee', icon: 'code', createdAt: iso(now), updatedAt: iso(now) },
    { id: 'seed-expense-comida', name: 'Comida', type: 'expense', color: '#f59e0b', icon: 'shopping-cart', createdAt: iso(now), updatedAt: iso(now) },
    { id: 'seed-expense-transporte', name: 'Transporte', type: 'expense', color: '#3b82f6', icon: 'car', createdAt: iso(now), updatedAt: iso(now) },
    { id: 'seed-expense-servicios', name: 'Servicios', type: 'expense', color: '#ef4444', icon: 'bolt', createdAt: iso(now), updatedAt: iso(now) },
    { id: 'seed-expense-ocio', name: 'Ocio', type: 'expense', color: '#a855f7', icon: 'ticket', createdAt: iso(now), updatedAt: iso(now) },
    { id: 'seed-expense-salud', name: 'Salud', type: 'expense', color: '#14b8a6', icon: 'heart', createdAt: iso(now), updatedAt: iso(now) }
  ];

  const transactions: StoredTransaction[] = [];
  const expenseCats: { id: string; name: string; base: number; count: number }[] = [
    { id: 'seed-expense-comida', name: 'Supermercado', base: 8000, count: 14 },
    { id: 'seed-expense-transporte', name: 'Nafta', base: 12000, count: 6 },
    { id: 'seed-expense-servicios', name: 'Factura', base: 15000, count: 3 },
    { id: 'seed-expense-ocio', name: 'Salida', base: 9000, count: 5 },
    { id: 'seed-expense-salud', name: 'Farmacia', base: 6000, count: 2 }
  ];

  for (let monthsBack = 3; monthsBack >= 0; monthsBack--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
    const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
    const lastDay = monthsBack === 0 ? now.getDate() : daysInMonth;

    transactions.push({
      id: rid(),
      categoryId: 'seed-income-salario',
      type: 'income',
      name: 'Sueldo',
      description: '',
      amount: 850000 + Math.round(Math.random() * 40000),
      date: iso(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)),
      createdAt: iso(now),
      updatedAt: iso(now)
    });

    if (Math.random() > 0.4) {
      transactions.push({
        id: rid(),
        categoryId: 'seed-income-freelance',
        type: 'income',
        name: 'Proyecto freelance',
        description: '',
        amount: 50000 + Math.round(Math.random() * 150000),
        date: iso(new Date(monthDate.getFullYear(), monthDate.getMonth(), 5 + Math.floor(Math.random() * 10))),
        createdAt: iso(now),
        updatedAt: iso(now)
      });
    }

    for (const cat of expenseCats) {
      for (let i = 0; i < cat.count; i++) {
        const day = 1 + Math.floor(Math.random() * lastDay);
        transactions.push({
          id: rid(),
          categoryId: cat.id,
          type: 'expense',
          name: cat.name,
          description: '',
          amount: Math.round(cat.base * (0.6 + Math.random() * 0.8)),
          date: iso(new Date(monthDate.getFullYear(), monthDate.getMonth(), day)),
          createdAt: iso(now),
          updatedAt: iso(now)
        });
      }
    }
  }

  const bills: StoredBill[] = [
    {
      id: rid(),
      name: 'Internet',
      description: '',
      categoryId: 'seed-expense-servicios',
      approxAmount: 18000,
      period: 'monthly',
      dueDate: iso(new Date(now.getFullYear(), now.getMonth(), Math.min(now.getDate() + 3, 28))),
      active: true,
      payments: [],
      createdAt: iso(now),
      updatedAt: iso(now)
    },
    {
      id: rid(),
      name: 'Gimnasio',
      description: '',
      categoryId: 'seed-expense-salud',
      approxAmount: 12000,
      period: 'monthly',
      dueDate: iso(new Date(now.getFullYear(), now.getMonth(), Math.min(now.getDate() + 9, 28))),
      active: true,
      payments: [],
      createdAt: iso(now),
      updatedAt: iso(now)
    },
    {
      id: rid(),
      name: 'Netflix',
      description: '',
      categoryId: 'seed-expense-ocio',
      approxAmount: 6000,
      period: 'monthly',
      dueDate: iso(new Date(now.getFullYear(), now.getMonth(), Math.max(now.getDate() - 2, 1))),
      active: true,
      payments: [],
      createdAt: iso(now),
      updatedAt: iso(now)
    }
  ];

  localStorage.setItem('categories', JSON.stringify(categories));
  localStorage.setItem('transactions', JSON.stringify(transactions));
  localStorage.setItem('bills', JSON.stringify(bills));
}
