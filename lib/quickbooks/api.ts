import { getValidQuickBooksConnection } from './auth';

export async function qboRequest(path: string, init?: RequestInit) {
  const conn = await getValidQuickBooksConnection();

  const baseUrl =
      conn.environment === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';

  const separator = path.includes('?') ? '&' : '?';

  console.log('QB env:', conn.environment);
  console.log('QB realm:', conn.realm_id);
  console.log('QB baseUrl:', baseUrl);

  const res = await fetch(
    `${baseUrl}/v3/company/${conn.realm_id}${path}${separator}minorversion=75`,
    {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${conn.access_token}`,
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
    }
  );

  const json = await res.json();

  if (!res.ok) {
    throw new Error(JSON.stringify(json));
  }

  return json;
}

export async function qboQuery(query: string) {
  const encoded = encodeURIComponent(query);
  return qboRequest(`/query?query=${encoded}`, { method: 'GET' });
}