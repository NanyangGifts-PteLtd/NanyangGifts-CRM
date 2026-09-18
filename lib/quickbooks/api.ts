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

export async function qboUploadAttachment(
  file: File,
  attachedEntity: { id: string; type: string },
) {
  const conn = await getValidQuickBooksConnection();
  const baseUrl =
    conn.environment === "production"
      ? "https://quickbooks.api.intuit.com"
      : "https://sandbox-quickbooks.api.intuit.com";
  const payload = new FormData();
  payload.append(
    "file_metadata_01",
    new Blob(
      [
        JSON.stringify({
          FileName: file.name,
          ContentType: file.type || "application/octet-stream",
          AttachableRef: [
            { EntityRef: { value: attachedEntity.id, type: attachedEntity.type } },
          ],
        }),
      ],
      { type: "application/json" },
    ),
    "metadata.json",
  );
  payload.append("file_content_01", file, file.name);

  const response = await fetch(
    `${baseUrl}/v3/company/${conn.realm_id}/upload?minorversion=75`,
    {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${conn.access_token}` },
      body: payload,
      cache: "no-store",
    },
  );
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(JSON.stringify(result));
  return result;
}
