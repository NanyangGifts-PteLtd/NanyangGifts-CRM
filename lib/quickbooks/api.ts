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

/** Downloads a binary document from QuickBooks, such as an Estimate PDF. */
export async function qboDownload(path: string) {
  const conn = await getValidQuickBooksConnection();
  const baseUrl =
    conn.environment === "production"
      ? "https://quickbooks.api.intuit.com"
      : "https://sandbox-quickbooks.api.intuit.com";
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(
    `${baseUrl}/v3/company/${conn.realm_id}${path}${separator}minorversion=75`,
    {
      headers: {
        Accept: "application/pdf",
        Authorization: `Bearer ${conn.access_token}`,
      },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `QuickBooks download failed (${response.status})`);
  }
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "application/pdf",
  };
}

export async function qboQuery(query: string) {
  const encoded = encodeURIComponent(query);
  return qboRequest(`/query?query=${encoded}`, { method: 'GET' });
}

function quoteQueryValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

// Protect against rapid double-clicks/retries in the same application worker.
// The QuickBooks recovery below remains the cross-worker safeguard.
const inFlightQuickBooksBills = new Set<string>();

/**
 * Resolves a typed supplier name before creating a Vendor. This avoids a
 * duplicate Vendor when a previous request created it but did not get as far
 * as creating its Bill, or when two users submit the same new supplier.
 */
export async function resolveQuickBooksVendor(
  supplierId: unknown,
  supplierName: unknown,
) {
  const suppliedId = String(supplierId ?? "").trim();
  if (suppliedId) return { id: suppliedId, created: false };
  const name = String(supplierName ?? "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!name)
    throw new Error("Supplier name is required to create a new QuickBooks supplier.");

  const findExisting = async () => {
    const result = await qboQuery(
      `SELECT Id, DisplayName FROM Vendor WHERE DisplayName = '${quoteQueryValue(name)}'`,
    );
    const vendor = (result?.QueryResponse?.Vendor ?? []).find(
      (candidate: { Id?: unknown; DisplayName?: unknown }) =>
        String(candidate.DisplayName ?? "").trim().toLocaleLowerCase() ===
        name.toLocaleLowerCase(),
    );
    const id = String(vendor?.Id ?? "").trim();
    return id || null;
  };

  const existingId = await findExisting();
  if (existingId) return { id: existingId, created: false };
  try {
    return { id: await createQuickBooksVendor(name), created: true };
  } catch (error) {
    // A parallel request can create the same name between our lookup and POST.
    const racedId = await findExisting().catch(() => null);
    if (racedId) return { id: racedId, created: false };
    throw error;
  }
}

async function findQuickBooksBill(supplierId: string, billNumber: string) {
  const result = await qboQuery(
    `SELECT Id, DocNumber, VendorRef, TxnTaxDetail FROM Bill WHERE VendorRef = '${quoteQueryValue(supplierId)}' AND DocNumber = '${quoteQueryValue(billNumber)}'`,
  );
  return (result?.QueryResponse?.Bill ?? []).find(
    (bill: { Id?: unknown }) => Boolean(String(bill.Id ?? "").trim()),
  );
}

async function removeUnusedQuickBooksVendor(vendorId: string) {
  const current = await qboRequest(`/vendor/${encodeURIComponent(vendorId)}`, {
    method: "GET",
  });
  const vendor = current?.Vendor;
  if (!vendor?.Id || vendor.SyncToken == null) return;
  await qboRequest("/vendor?operation=delete", {
    method: "POST",
    body: JSON.stringify({ Id: vendor.Id, SyncToken: vendor.SyncToken }),
  });
}

/**
 * QBO Vendor and Bill creation cannot be wrapped in one transaction. If the
 * Bill request times out after QBO accepted it, recover that Bill by its
 * vendor/document-number pair. If it genuinely failed, remove the Vendor we
 * created in this request so it is not left orphaned.
 */
export async function createQuickBooksBillSafely({
  supplierId,
  billNumber,
  billPayload,
  createdVendor,
}: {
  supplierId: string;
  billNumber: string;
  billPayload: Record<string, unknown>;
  createdVendor: boolean;
}) {
  const key = `${supplierId}::${billNumber.trim().toLocaleLowerCase()}`;
  if (inFlightQuickBooksBills.has(key))
    throw new Error(
      "A QuickBooks Bill with this Supplier and Invoice no. is already being created.",
    );
  inFlightQuickBooksBills.add(key);
  try {
    const result = await qboRequest("/bill", {
      method: "POST",
      body: JSON.stringify(billPayload),
    });
    if (!result?.Bill?.Id)
      throw new Error("QuickBooks did not return a Bill ID.");
    return result.Bill;
  } catch (error) {
    const recoveredBill = await findQuickBooksBill(supplierId, billNumber).catch(
      () => null,
    );
    if (recoveredBill) return recoveredBill;
    if (createdVendor) {
      await removeUnusedQuickBooksVendor(supplierId).catch(() => undefined);
    }
    throw error;
  } finally {
    inFlightQuickBooksBills.delete(key);
  }
}

/** Creates a QuickBooks Vendor from a free-text supplier name. */
export async function createQuickBooksVendor(supplierName: unknown) {
  const name = String(supplierName ?? "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!name)
    throw new Error(
      "Supplier name is required to create a new QuickBooks supplier.",
    );

  const result = await qboRequest("/vendor", {
    method: "POST",
    body: JSON.stringify({
      DisplayName: name,
      CompanyName: name,
      GivenName: name,
    }),
  });
  const id = String(result?.Vendor?.Id ?? "").trim();
  if (!id) throw new Error("QuickBooks could not create the new Supplier.");
  return id;
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
