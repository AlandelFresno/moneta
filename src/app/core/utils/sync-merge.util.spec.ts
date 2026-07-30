import { mergeEntities, purgeOldTombstones, SyncableEntity } from './sync-merge.util';

interface TestEntity extends SyncableEntity {
  value: string;
}

function entity(overrides: Partial<TestEntity> & { id: string }): TestEntity {
  return {
    updatedAt: new Date(2026, 0, 1),
    value: 'default',
    ...overrides
  };
}

describe('mergeEntities', () => {
  it('keeps a local-only item without counting it as added or updated', () => {
    const local = [entity({ id: 'a', value: 'local-only' })];
    const result = mergeEntities(local, []);

    expect(result.merged).toEqual(local);
    expect(result.added).toBe(0);
    expect(result.updated).toBe(0);
  });

  it('keeps a remote-only item and counts it as added', () => {
    const remote = [entity({ id: 'a', value: 'remote-only' })];
    const result = mergeEntities([], remote);

    expect(result.merged).toEqual(remote);
    expect(result.added).toBe(1);
    expect(result.updated).toBe(0);
  });

  it('keeps the local version when both are present and local is newer', () => {
    const local = [entity({ id: 'a', value: 'local', updatedAt: new Date(2026, 0, 10) })];
    const remote = [entity({ id: 'a', value: 'remote', updatedAt: new Date(2026, 0, 5) })];

    const result = mergeEntities(local, remote);
    expect(result.merged).toEqual([local[0]]);
    expect(result.added).toBe(0);
    expect(result.updated).toBe(1);
  });

  it('keeps the remote version when both are present and remote is newer', () => {
    const local = [entity({ id: 'a', value: 'local', updatedAt: new Date(2026, 0, 5) })];
    const remote = [entity({ id: 'a', value: 'remote', updatedAt: new Date(2026, 0, 10) })];

    const result = mergeEntities(local, remote);
    expect(result.merged).toEqual([remote[0]]);
  });

  it('breaks a tie on identical updatedAt in favor of local', () => {
    const sameTime = new Date(2026, 0, 1);
    const local = [entity({ id: 'a', value: 'local', updatedAt: sameTime })];
    const remote = [entity({ id: 'a', value: 'remote', updatedAt: sameTime })];

    const result = mergeEntities(local, remote);
    expect(result.merged).toEqual([local[0]]);
  });

  it('propagates a newer local tombstone over an older active remote item', () => {
    const local = [entity({ id: 'a', value: 'local', updatedAt: new Date(2026, 0, 10), deletedAt: new Date(2026, 0, 10) })];
    const remote = [entity({ id: 'a', value: 'remote', updatedAt: new Date(2026, 0, 5) })];

    const result = mergeEntities(local, remote);
    expect(result.merged[0].deletedAt).toBeTruthy();
  });

  it('propagates a newer remote tombstone over an older active local item', () => {
    const local = [entity({ id: 'a', value: 'local', updatedAt: new Date(2026, 0, 5) })];
    const remote = [entity({ id: 'a', value: 'remote', updatedAt: new Date(2026, 0, 10), deletedAt: new Date(2026, 0, 10) })];

    const result = mergeEntities(local, remote);
    expect(result.merged[0].deletedAt).toBeTruthy();
  });

  it('produces no duplicate ids by construction', () => {
    const local = [entity({ id: 'a' }), entity({ id: 'b' })];
    const remote = [entity({ id: 'a' }), entity({ id: 'c' })];

    const result = mergeEntities(local, remote);
    const ids = result.merged.map((item) => item.id).sort();
    expect(ids).toEqual(['a', 'b', 'c']);
  });
});

describe('purgeOldTombstones', () => {
  it('drops a tombstone older than the max age', () => {
    const now = new Date(2026, 5, 1);
    const items = [entity({ id: 'a', deletedAt: new Date(2026, 3, 1) })]; // ~61 days before now

    const result = purgeOldTombstones(items, now, 30);
    expect(result).toEqual([]);
  });

  it('keeps a tombstone at or under the max age', () => {
    const now = new Date(2026, 5, 1);
    const items = [entity({ id: 'a', deletedAt: new Date(2026, 4, 15) })]; // ~17 days before now

    const result = purgeOldTombstones(items, now, 30);
    expect(result).toEqual(items);
  });

  it('keeps active (non-deleted) items regardless of age', () => {
    const now = new Date(2026, 5, 1);
    const items = [entity({ id: 'a', updatedAt: new Date(2020, 0, 1) })];

    const result = purgeOldTombstones(items, now, 30);
    expect(result).toEqual(items);
  });
});
