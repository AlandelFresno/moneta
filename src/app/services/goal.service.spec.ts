import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GoalService } from './goal.service';

describe('GoalService', () => {
  let service: GoalService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    service = TestBed.inject(GoalService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('CRUD + persistence', () => {
    it('creates a goal with generated id and given target/current amounts', async () => {
      const created = await firstValueFrom(
        service.create({ name: 'Vacaciones', targetAmount: 5000, currentAmount: 0, color: '#10b981', icon: 'flag' })
      );
      expect(created.id).toBeTruthy();
      expect(created.targetAmount).toBe(5000);
      expect(created.currentAmount).toBe(0);
    });

    it('soft-deletes, removing it from getAll but keeping it in storage', async () => {
      const created = await firstValueFrom(
        service.create({ name: 'Auto', targetAmount: 20000, currentAmount: 0, color: '#3b82f6', icon: 'flag' })
      );
      await firstValueFrom(service.delete(created.id));

      const all = await firstValueFrom(service.getAll());
      expect(all.find((g) => g.id === created.id)).toBeUndefined();

      const tombstone = service.getAllIncludingDeleted().find((g) => g.id === created.id);
      expect(tombstone?.deletedAt).toEqual(jasmine.any(Date));
    });

    it('replaceAll persists and emits exactly what is passed', async () => {
      const created = await firstValueFrom(
        service.create({ name: 'Auto', targetAmount: 20000, currentAmount: 500, color: '#3b82f6', icon: 'flag' })
      );
      const replacement = { ...created, currentAmount: 999 };

      service.replaceAll([replacement]);

      const all = await firstValueFrom(service.getAll());
      expect(all.length).toBe(1);
      expect(all[0].currentAmount).toBe(999);
    });

    it('persists across service instances via localStorage', async () => {
      await firstValueFrom(
        service.create({ name: 'Casa', targetAmount: 100000, currentAmount: 12345, color: '#f59e0b', icon: 'flag' })
      );

      const fresh = new GoalService();
      const all = await firstValueFrom(fresh.getAll());
      expect(all.some((g) => g.currentAmount === 12345)).toBeTrue();
    });
  });

  describe('adjustAmount', () => {
    it('applies a positive or negative delta in place', async () => {
      const created = await firstValueFrom(
        service.create({ name: 'Vacaciones', targetAmount: 5000, currentAmount: 1000, color: '#10b981', icon: 'flag' })
      );

      service.adjustAmount(created.id, 500);
      let all = await firstValueFrom(service.getAll());
      expect(all.find((g) => g.id === created.id)?.currentAmount).toBe(1500);

      service.adjustAmount(created.id, -300);
      all = await firstValueFrom(service.getAll());
      expect(all.find((g) => g.id === created.id)?.currentAmount).toBe(1200);
    });
  });

  describe('contribute / deleteContribution', () => {
    it('adds funds to the goal and records the contribution', async () => {
      const goal = await firstValueFrom(
        service.create({ name: 'Vacaciones', targetAmount: 5000, currentAmount: 0, color: '#10b981', icon: 'flag' })
      );

      await firstValueFrom(service.contribute(goal.id, 300, new Date(2026, 0, 1), 'Ahorro mensual'));

      const all = await firstValueFrom(service.getAll());
      expect(all.find((g) => g.id === goal.id)?.currentAmount).toBe(300);

      const contributions = await firstValueFrom(service.getContributions());
      expect(contributions.length).toBe(1);
      expect(contributions[0].amount).toBe(300);
    });

    it('supports a negative amount as a withdrawal', async () => {
      const goal = await firstValueFrom(
        service.create({ name: 'Vacaciones', targetAmount: 5000, currentAmount: 500, color: '#10b981', icon: 'flag' })
      );

      await firstValueFrom(service.contribute(goal.id, -200, new Date(2026, 0, 1), 'Retiro'));

      const all = await firstValueFrom(service.getAll());
      expect(all.find((g) => g.id === goal.id)?.currentAmount).toBe(300);
    });

    it('reverses the amount effect and soft-deletes the contribution', async () => {
      const goal = await firstValueFrom(
        service.create({ name: 'Vacaciones', targetAmount: 5000, currentAmount: 0, color: '#10b981', icon: 'flag' })
      );
      const contribution = await firstValueFrom(service.contribute(goal.id, 300, new Date(2026, 0, 1), ''));

      await firstValueFrom(service.deleteContribution(contribution.id));

      const all = await firstValueFrom(service.getAll());
      expect(all.find((g) => g.id === goal.id)?.currentAmount).toBe(0);

      const contributions = await firstValueFrom(service.getContributions());
      expect(contributions.length).toBe(0);
    });
  });
});
