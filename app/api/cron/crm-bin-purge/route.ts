import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const BUCKET = "crm-files";
const RETENTION_MS = 30 * 86_400_000;

function authorized(request: NextRequest) {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const left = Buffer.from(supplied);
  const right = Buffer.from(secret);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function filesBelow(prefix: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).list(prefix, { limit: 1000 });
  if (error) throw error;
  const paths: string[] = [];
  for (const entry of data ?? []) {
    const child = `${prefix}/${entry.name}`;
    // Storage folders have no object id; recurse to obtain their files.
    if (entry.id) paths.push(child);
    else paths.push(...await filesBelow(child));
  }
  return paths;
}

async function removeStoragePrefix(prefix: string) {
  const paths = await filesBelow(prefix);
  for (let index = 0; index < paths.length; index += 1000) {
    const { error } = await supabaseAdmin.storage.from(BUCKET).remove(paths.slice(index, index + 1000));
    if (error) throw error;
  }
  return paths.length;
}

async function writeAudit(entry: { entityType: "client" | "subitem"; entityId: string; clientId?: string | null; name: string; deletedAt: string }) {
  const { error } = await supabaseAdmin.from("crm_bin_purge_log").insert({
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    client_id: entry.clientId ?? null,
    record_name: entry.name,
    deleted_at: entry.deletedAt,
    purged_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cutoff = new Date(Date.now() - RETENTION_MS).toISOString();
  const [{ data: clients, error: clientsError }, { data: subitems, error: subitemsError }] = await Promise.all([
    supabaseAdmin
      .from("clients")
      .select("id, name, deleted_at, subitems!subitems_client_id_fkey(id)")
      .not("deleted_at", "is", null)
      .lte("deleted_at", cutoff),
    supabaseAdmin
      .from("subitems")
      .select("id, client_id, name, deleted_at")
      .not("deleted_at", "is", null)
      .is("deleted_with_client_id", null)
      .lte("deleted_at", cutoff),
  ]);
  if (clientsError) return NextResponse.json({ error: clientsError.message }, { status: 500 });
  if (subitemsError) return NextResponse.json({ error: subitemsError.message }, { status: 500 });

  const clientIds = new Set((clients ?? []).map((client) => client.id));
  let filesRemoved = 0;
  let clientsPurged = 0;
  let subitemsPurged = 0;

  try {
    for (const client of clients ?? []) {
      filesRemoved += await removeStoragePrefix(`clients/${client.id}`);
      for (const subitem of client.subitems ?? []) {
        filesRemoved += await removeStoragePrefix(`subitems/${client.id}/${subitem.id}`);
      }
      const { error } = await supabaseAdmin.from("clients").delete().eq("id", client.id).not("deleted_at", "is", null);
      if (error) throw error;
      await writeAudit({ entityType: "client", entityId: client.id, name: client.name ?? "Unnamed client", deletedAt: client.deleted_at });
      clientsPurged += 1;
    }

    for (const subitem of subitems ?? []) {
      if (clientIds.has(subitem.client_id)) continue;
      filesRemoved += await removeStoragePrefix(`subitems/${subitem.client_id}/${subitem.id}`);
      const { error } = await supabaseAdmin.from("subitems").delete().eq("id", subitem.id).not("deleted_at", "is", null);
      if (error) throw error;
      await writeAudit({ entityType: "subitem", entityId: subitem.id, clientId: subitem.client_id, name: subitem.name ?? "Unnamed subitem", deletedAt: subitem.deleted_at });
      subitemsPurged += 1;
    }
  } catch (error: any) {
    console.error("CRM Bin purge failed", error);
    return NextResponse.json({ error: error?.message || "CRM Bin purge failed", clientsPurged, subitemsPurged, filesRemoved }, { status: 500 });
  }

  return NextResponse.json({ ok: true, cutoff, clientsPurged, subitemsPurged, filesRemoved });
}
