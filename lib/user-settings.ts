export async function loadUserSetting(key: string): Promise<any | null> {
  try {
    const res = await fetch(`/api/user-settings?key=${encodeURIComponent(key)}`);
    if (!res.ok) {
      // If the user is not authenticated, don't treat as an error
      if (res.status === 401) return null;
      const text = await res.text().catch(() => '');
      throw new Error(`Failed to load (${res.status}) ${text}`);
    }
    const data = await res.json();
    return data?.value ?? null;
  } catch (e) {
    // Only log unexpected errors to avoid noisy logs during logout/auth flows
    if (e && (e as any).message && !(e as any).message.includes('401')) {
      console.warn('loadUserSetting failed', e);
    }
    return null;
  }
}

export async function saveUserSetting(key: string, value: any): Promise<boolean> {
  try {
    const res = await fetch(`/api/user-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    });
    if (!res.ok) {
      // if unauthenticated, fail silently (we already write to localStorage)
      if (res.status === 401) return false;
      const text = await res.text().catch(() => '');
      throw new Error(`Failed to save (${res.status}) ${text}`);
    }
    const data = await res.json();
    return data?.ok === true;
  } catch (e) {
    // Avoid noisy logs for expected auth race conditions during logout
    if (e && (e as any).message && !(e as any).message.includes('401')) {
      console.warn('saveUserSetting failed', e);
    }
    return false;
  }
}
