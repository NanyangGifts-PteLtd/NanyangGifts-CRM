type RecordKind = "client" | "subitem";

type PendingWrite = {
  count: number;
  protectUntil: number;
};

const pendingWrites = new Map<string, PendingWrite>();
const writeQueues = new Map<string, Promise<unknown>>();
let writeRevision = 0;
// Supabase may deliver the record change and related trigger/audit traffic at
// slightly different times. Keep the optimistic value authoritative until
// those echoes have cleared.
const SETTLE_GRACE_MS = 2500;

const recordKey = (kind: RecordKind, id: string) => `${kind}:${id}`;

export function isBoardRecordProtected(kind: RecordKind, id: string) {
  const pending = pendingWrites.get(recordKey(kind, id));
  if (!pending) return false;
  if (pending.count === 0 && pending.protectUntil <= Date.now()) {
    pendingWrites.delete(recordKey(kind, id));
    return false;
  }
  return true;
}

export function boardProtectionDelay() {
  const now = Date.now();
  let delay = 0;
  for (const [key, pending] of pendingWrites) {
    if (pending.count > 0) {
      delay = Math.max(delay, SETTLE_GRACE_MS);
      continue;
    }
    if (pending.protectUntil <= now) pendingWrites.delete(key);
    else delay = Math.max(delay, pending.protectUntil - now);
  }
  return delay;
}

/** Monotonic marker used to reject refreshes that began before a newer edit. */
export function getBoardWriteRevision() {
  return writeRevision;
}

/**
 * Keep writes for one record ordered. Rapid A -> B edits can otherwise finish
 * B -> A over the network, leaving both Realtime and the database on A.
 */
export async function enqueueBoardWrite<T>(
  kind: RecordKind,
  id: string,
  write: () => Promise<T>,
): Promise<T> {
  const key = recordKey(kind, id);
  writeRevision += 1;
  const pending = pendingWrites.get(key) ?? { count: 0, protectUntil: 0 };
  pending.count += 1;
  pending.protectUntil = Number.POSITIVE_INFINITY;
  pendingWrites.set(key, pending);

  const previous = writeQueues.get(key) ?? Promise.resolve();
  const queued = previous.catch(() => undefined).then(write);
  writeQueues.set(key, queued);

  try {
    return await queued;
  } finally {
    const current = pendingWrites.get(key);
    if (current) {
      current.count = Math.max(0, current.count - 1);
      if (current.count === 0) current.protectUntil = Date.now() + SETTLE_GRACE_MS;
    }
    if (writeQueues.get(key) === queued) writeQueues.delete(key);
  }
}
