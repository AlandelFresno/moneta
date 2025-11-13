export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CategoryType = Category['type'];
