const loadedValues = new Map<string, any>();
const pendingValues = new Map<string, Promise<any | null>>();
const pendingKeys = new Set<string>();
let batchPromise: Promise<void> | null = null;
// Writes for the same setting must remain ordered. Returning the in-flight
// request used to silently discard a newer value (for example, a column width
// changed again while the previous width was still saving).
const saveQueues = new Map<string, Promise<boolean>>();
const savedSignatures = new Map<string, string>();

const signatureFor = (value: any) =>
  typeof value === "string" || value == null ? String(value) : JSON.stringify(value);

async function fetchPendingSettings() {
  const keys = Array.from(pendingKeys);
  pendingKeys.clear();
  if (!keys.length) return;
  try {
    const params = new URLSearchParams();
    keys.forEach((key) => params.append("key", key));
    const res = await fetch(`/api/user-settings?${params.toString()}`);
    if (!res.ok) {
      if (res.status === 401) return;
      throw new Error(`Failed to load user settings (${res.status})`);
    }
    const data = await res.json();
    const values = data?.values ?? Object.fromEntries(keys.map((key) => [key, data?.value ?? null]));
    for (const key of keys) {
      const value = values[key] ?? null;
      loadedValues.set(key, value);
      savedSignatures.set(key, signatureFor(value));
    }
  } catch (error) {
    console.warn("loadUserSetting failed", error);
    keys.forEach((key) => loadedValues.set(key, null));
  } finally {
    keys.forEach((key) => pendingValues.delete(key));
  }
}

async function drainPendingSettings() {
  while (pendingKeys.size) {
    if (!batchPromise) {
      batchPromise = fetchPendingSettings().finally(() => {
        batchPromise = null;
      });
    }
    await batchPromise;
  }
}

export function loadUserSetting(key: string): Promise<any | null> {
  if (loadedValues.has(key)) return Promise.resolve(loadedValues.get(key));
  const pending = pendingValues.get(key);
  if (pending) return pending;

  pendingKeys.add(key);
  const request = new Promise<any | null>((resolve) => {
    queueMicrotask(() => {
      void drainPendingSettings().then(() =>
        resolve(loadedValues.get(key) ?? null),
      );
    });
  });
  pendingValues.set(key, request);
  return request;
}

export async function saveUserSetting(key: string, value: any): Promise<boolean> {
  const signature = signatureFor(value);
  const previous = saveQueues.get(key) ?? Promise.resolve(true);
  const request = previous
    .catch(() => false)
    .then(async () => {
      // This check happens when the queued write starts, so an identical
      // already-saved value does not produce an unnecessary request.
      if (savedSignatures.get(key) === signature) return true;
      try {
        const res = await fetch(`/api/user-settings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, value }),
        });
        if (!res.ok) {
          if (res.status === 401) return false;
          throw new Error(`Failed to save (${res.status})`);
        }
        const data = await res.json();
        if (data?.ok === true) {
          loadedValues.set(key, value);
          savedSignatures.set(key, signature);
          return true;
        }
        return false;
      } catch (error) {
        console.warn("saveUserSetting failed", error);
        return false;
      }
    });
  saveQueues.set(key, request);
  void request.then(() => {
    if (saveQueues.get(key) === request) saveQueues.delete(key);
  });
  return request;
}
