import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AccountService } from './account.service';

describe('AccountService', () => {
  let service: AccountService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    service = TestBed.inject(AccountService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('CRUD + persistence', () => {
    it('creates an account with generated id and given balance', async () => {
      const created = await firstValueFrom(
        service.create({ name: 'Efectivo', type: 'cash', balance: 1000, color: '#10b981', icon: 'wallet' })
      );
      expect(created.id).toBeTruthy();
      expect(created.balance).toBe(1000);
    });

    it('soft-deletes, removing it from getAll but keeping it in storage', async () => {
      const created = await firstValueFrom(service.create({ name: 'Banco', type: 'bank', balance: 0, color: '#3b82f6', icon: 'building' }));
      await firstValueFrom(service.delete(created.id));

      const all = await firstValueFrom(service.getAll());
      expect(all.find((a) => a.id === created.id)).toBeUndefined();

      const tombstone = service.getAllIncludingDeleted().find((a) => a.id === created.id);
      expect(tombstone?.deletedAt).toEqual(jasmine.any(Date));
    });

    it('replaceAll persists and emits exactly what is passed', async () => {
      const created = await firstValueFrom(service.create({ name: 'Banco', type: 'bank', balance: 500, color: '#3b82f6', icon: 'building' }));
      const replacement = { ...created, balance: 999 };

      service.replaceAll([replacement]);

      const all = await firstValueFrom(service.getAll());
      expect(all.length).toBe(1);
      expect(all[0].balance).toBe(999);
    });

    it('persists across service instances via localStorage', async () => {
      await firstValueFrom(service.create({ name: 'Ahorros', type: 'savings', balance: 12345, color: '#f59e0b', icon: 'piggy-bank' }));

      const fresh = new AccountService();
      const all = await firstValueFrom(fresh.getAll());
      expect(all.some((a) => a.balance === 12345)).toBeTrue();
    });
  });

  describe('reconciliation fields', () => {
    it('persists reconciledAt/reconciledBalance and round-trips the date through storage', async () => {
      const created = await firstValueFrom(service.create({ name: 'Banco', type: 'bank', balance: 1200, color: '#3b82f6', icon: 'building' }));
      const reconciledAt = new Date(2026, 0, 15);

      await firstValueFrom(service.update(created.id, { reconciledAt, reconciledBalance: 1200 }));

      const fresh = new AccountService();
      const all = await firstValueFrom(fresh.getAll());
      const updated = all.find((a) => a.id === created.id);

      expect(updated?.reconciledBalance).toBe(1200);
      expect(updated?.reconciledAt).toEqual(reconciledAt);
    });
  });

  describe('adjustBalance', () => {
    it('applies a positive or negative delta in place', async () => {
      const created = await firstValueFrom(service.create({ name: 'Efectivo', type: 'cash', balance: 1000, color: '#10b981', icon: 'wallet' }));

      service.adjustBalance(created.id, 500);
      let all = await firstValueFrom(service.getAll());
      expect(all.find((a) => a.id === created.id)?.balance).toBe(1500);

      service.adjustBalance(created.id, -300);
      all = await firstValueFrom(service.getAll());
      expect(all.find((a) => a.id === created.id)?.balance).toBe(1200);
    });
  });

  describe('transfer / deleteTransfer', () => {
    it('debits the source account and credits the destination', async () => {
      const from = await firstValueFrom(service.create({ name: 'Efectivo', type: 'cash', balance: 1000, color: '#10b981', icon: 'wallet' }));
      const to = await firstValueFrom(service.create({ name: 'Banco', type: 'bank', balance: 200, color: '#3b82f6', icon: 'building' }));

      await firstValueFrom(service.transfer(from.id, to.id, 300, new Date(2026, 0, 1), 'Depósito'));

      const all = await firstValueFrom(service.getAll());
      expect(all.find((a) => a.id === from.id)?.balance).toBe(700);
      expect(all.find((a) => a.id === to.id)?.balance).toBe(500);

      const transfers = await firstValueFrom(service.getTransfers());
      expect(transfers.length).toBe(1);
      expect(transfers[0].amount).toBe(300);
    });

    it('reverses both balance effects and soft-deletes the transfer', async () => {
      const from = await firstValueFrom(service.create({ name: 'Efectivo', type: 'cash', balance: 1000, color: '#10b981', icon: 'wallet' }));
      const to = await firstValueFrom(service.create({ name: 'Banco', type: 'bank', balance: 200, color: '#3b82f6', icon: 'building' }));
      const created = await firstValueFrom(service.transfer(from.id, to.id, 300, new Date(2026, 0, 1), ''));

      await firstValueFrom(service.deleteTransfer(created.id));

      const all = await firstValueFrom(service.getAll());
      expect(all.find((a) => a.id === from.id)?.balance).toBe(1000);
      expect(all.find((a) => a.id === to.id)?.balance).toBe(200);

      const transfers = await firstValueFrom(service.getTransfers());
      expect(transfers.length).toBe(0);
    });
  });
});
