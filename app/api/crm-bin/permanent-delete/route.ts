import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const BUCKET = "crm-files";

async function filesBelow(prefix: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).list(prefix, { limit: 1000 });
  if (error) throw error;
  const paths: string[] = [];
  for (const entry of data ?? []) {
    const child = `${prefix}/${entry.name}`;
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

async function assertPurgeAllowed(userId: string, table: "clients" | "subitems", id: string) {
  const { data: profile, error: profileError } = await supabaseAdmin.from("profiles").select("role").eq("id", userId).single();
  if (profileError) throw profileError;
  if (["director", "dev"].includes(String(profile?.role ?? "").toLowerCase())) return;
  const { data: item, error } = await supabaseAdmin.from(table).select("created_at, deletion_owner_id").eq("id", id).single();
  if (error) throw error;
  if (!item.created_at || Date.now() - new Date(item.created_at).getTime() >= 72 * 3_600_000 || item.deletion_owner_id !== userId) {
    throw new Error("You can only permanently delete items you created within 72 hours, unless you are a director or developer.");
  }
}

async function audit(entry: { type: "client" | "subitem"; id: string; clientId?: string | null; name: string; deletedAt: string }) {
  const { error } = await supabaseAdmin.from("crm_bin_purge_log").insert({
    entity_type: entry.type, entity_id: entry.id, client_id: entry.clientId ?? null,
    record_name: entry.name, deleted_at: entry.deletedAt, purged_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function POST(request: NextRequest) {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const type = body?.type === "client" || body?.type === "subitem" ? body.type : null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!type || !id) return NextResponse.json({ error: "A Bin item is required." }, { status: 400 });

  try {
    await assertPurgeAllowed(user.id, type === "client" ? "clients" : "subitems", id);
    if (type === "client") {
      const { data: client, error } = await supabaseAdmin.from("clients").select("id, name, deleted_at, subitems!subitems_client_id_fkey(id)").eq("id", id).not("deleted_at", "is", null).single();
      if (error || !client) throw new Error("This client is no longer available in the Bin.");
      let filesRemoved = await removeStoragePrefix(`clients/${client.id}`);
      for (const subitem of client.subitems ?? []) filesRemoved += await removeStoragePrefix(`subitems/${client.id}/${subitem.id}`);
      const { error: deleteError } = await supabaseAdmin.from("clients").delete().eq("id", id).not("deleted_at", "is", null);
      if (deleteError) throw deleteError;
      await audit({ type, id, name: client.name ?? "Unnamed client", deletedAt: client.deleted_at });
      return NextResponse.json({ ok: true, filesRemoved });
    }

    const { data: subitem, error } = await supabaseAdmin.from("subitems").select("id, client_id, name, deleted_at").eq("id", id).not("deleted_at", "is", null).single();
    if (error || !subitem) throw new Error("This subitem is no longer available in the Bin.");
    const filesRemoved = await removeStoragePrefix(`subitems/${subitem.client_id}/${subitem.id}`);
    const { error: deleteError } = await supabaseAdmin.from("subitems").delete().eq("id", id).not("deleted_at", "is", null);
    if (deleteError) throw deleteError;
    await audit({ type, id, clientId: subitem.client_id, name: subitem.name ?? "Unnamed subitem", deletedAt: subitem.deleted_at });
    return NextResponse.json({ ok: true, filesRemoved });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Item could not be permanently deleted." }, { status: 400 });
  }
}
