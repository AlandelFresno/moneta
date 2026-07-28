export interface SyncableEntity {
  id: string;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface MergeResult<T extends SyncableEntity> {
  merged: T[];
  added: number;
  updated: number;
}

/** Union of local+remote by id; the newer `updatedAt` wins (ties go to local). */
export function mergeEntities<T extends SyncableEntity>(local: T[], remote: T[]): MergeResult<T> {
  const localMap = new Map(local.map((item) => [item.id, item]));
  const remoteMap = new Map(remote.map((item) => [item.id, item]));
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);

  const merged: T[] = [];
  let added = 0;
  let updated = 0;

  for (const id of allIds) {
    const localItem = localMap.get(id);
    const remoteItem = remoteMap.get(id);

    if (localItem && remoteItem) {
      const winner = localItem.updatedAt.getTime() >= remoteItem.updatedAt.getTime() ? localItem : remoteItem;
      merged.push(winner);
      updated++;
    } else if (localItem) {
      merged.push(localItem);
    } else if (remoteItem) {
      merged.push(remoteItem);
      added++;
    }
  }

  return { merged, added, updated };
}

/** Hard-drops tombstones older than `maxAgeDays` so the synced payload doesn't grow forever. */
export function purgeOldTombstones<T extends SyncableEntity>(items: T[], now: Date, maxAgeDays = 30): T[] {
  const cutoff = now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000;
  return items.filter((item) => !item.deletedAt || item.deletedAt.getTime() > cutoff);
}
