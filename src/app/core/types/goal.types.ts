export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: Date;
  color: string;
  icon: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface GoalContribution {
  id: string;
  goalId: string;
  amount: number;
  date: Date;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
