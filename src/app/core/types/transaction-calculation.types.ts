export interface TransactionCalculation {
  id: string;
  transactionId: string;
  expression: string;
  result: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
