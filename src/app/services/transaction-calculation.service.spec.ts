import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TransactionCalculationService } from './transaction-calculation.service';

describe('TransactionCalculationService', () => {
  let service: TransactionCalculationService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    service = TestBed.inject(TransactionCalculationService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('creates a calculation with generated id, tied to a transaction', async () => {
    const created = await firstValueFrom(
      service.create({ transactionId: 'txn-1', expression: '1200 + 350 * 2', result: 1900 })
    );
    expect(created.id).toBeTruthy();
    expect(created.transactionId).toBe('txn-1');
    expect(created.result).toBe(1900);
  });

  it('filters by transaction id via getForTransaction', async () => {
    await firstValueFrom(service.create({ transactionId: 'txn-1', expression: '1+1', result: 2 }));
    await firstValueFrom(service.create({ transactionId: 'txn-2', expression: '2+2', result: 4 }));

    const forTxn1 = await firstValueFrom(service.getForTransaction('txn-1'));
    expect(forTxn1.length).toBe(1);
    expect(forTxn1[0].expression).toBe('1+1');
  });

  it('deleteForTransaction soft-deletes only calculations for that transaction', async () => {
    const a = await firstValueFrom(service.create({ transactionId: 'txn-1', expression: '1+1', result: 2 }));
    const b = await firstValueFrom(service.create({ transactionId: 'txn-2', expression: '2+2', result: 4 }));

    await firstValueFrom(service.deleteForTransaction('txn-1'));

    const all = await firstValueFrom(service.getAll());
    expect(all.find((c) => c.id === a.id)).toBeUndefined();
    expect(all.find((c) => c.id === b.id)).toBeDefined();
  });

  it('persists across service instances via localStorage', async () => {
    await firstValueFrom(service.create({ transactionId: 'txn-1', expression: '10*2', result: 20 }));

    const fresh = new TransactionCalculationService();
    const all = await firstValueFrom(fresh.getAll());
    expect(all.some((c) => c.result === 20)).toBeTrue();
  });
});
