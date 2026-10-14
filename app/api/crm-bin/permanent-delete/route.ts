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

async function assertPurgeAllowed(userId: string) {
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (profileError) throw profileError;
  if (["director", "dev"].includes(String(profile?.role ?? "").toLowerCase()))
    return;
  throw new Error(
    "Only directors and developers can permanently delete CRM Bin items.",
  );
}

async function audit(entry: { type: "client" | "subitem"; id: string; clientId?: string | null; name: string; deletedAt: string }) {
  const { error } = await supabaseAdmin.from("crm_bin_purge_log").insert({
    entity_type: entry.type, entity_id: entry.id, client_id: entry.clientId ?? null,
    record_name: entry.name, deleted_at: entry.deletedAt, purged_at: new Date().toISOString(),
  });
  if (error) throw error;
}

type BinItem = { type: "client" | "subitem"; id: string };

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function permanentlyDeleteItem({ type, id }: BinItem) {
  if (type === "client") {
    const { data: client, error } = await supabaseAdmin.from("clients").select("id, name, deleted_at, subitems!subitems_client_id_fkey(id)").eq("id", id).not("deleted_at", "is", null).single();
    if (error || !client) throw new Error("This client is no longer available in the Bin.");
    let filesRemoved = await removeStoragePrefix(`clients/${client.id}`);
    for (const subitem of client.subitems ?? []) filesRemoved += await removeStoragePrefix(`subitems/${client.id}/${subitem.id}`);
    const { error: deleteError } = await supabaseAdmin.from("clients").delete().eq("id", id).not("deleted_at", "is", null);
    if (deleteError) throw deleteError;
    await audit({ type, id, name: client.name ?? "Unnamed client", deletedAt: client.deleted_at });
    return { filesRemoved };
  }

  const { data: subitem, error } = await supabaseAdmin.from("subitems").select("id, client_id, name, deleted_at").eq("id", id).not("deleted_at", "is", null).single();
  if (error || !subitem) throw new Error("This subitem is no longer available in the Bin.");
  const filesRemoved = await removeStoragePrefix(`subitems/${subitem.client_id}/${subitem.id}`);
  const { error: deleteError } = await supabaseAdmin.from("subitems").delete().eq("id", id).not("deleted_at", "is", null);
  if (deleteError) throw deleteError;
  await audit({ type, id, clientId: subitem.client_id, name: subitem.name ?? "Unnamed subitem", deletedAt: subitem.deleted_at });
  return { filesRemoved };
}

async function deleteItemsWithConcurrency(items: BinItem[]) {
  const results: Array<
    BinItem & { ok: boolean; filesRemoved?: number; error?: string }
  > = new Array(items.length);
  let nextIndex = 0;
  const worker = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      const item = items[index];
      try {
        const { filesRemoved } = await permanentlyDeleteItem(item);
        results[index] = { ...item, ok: true, filesRemoved };
      } catch (error: unknown) {
        results[index] = {
          ...item,
          ok: false,
          error: errorMessage(error, "Item could not be permanently deleted."),
        };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, items.length) }, worker));
  return results;
}

export async function POST(request: NextRequest) {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const singleItem =
    (body?.type === "client" || body?.type === "subitem") &&
    typeof body?.id === "string"
      ? [{ type: body.type, id: body.id } as BinItem]
      : null;
  const batchItems = Array.isArray(body?.items)
    ? body.items
        .filter(
          (item: unknown): item is BinItem =>
            !!item &&
            typeof item === "object" &&
            (((item as BinItem).type === "client") ||
              (item as BinItem).type === "subitem") &&
            typeof (item as BinItem).id === "string" &&
            Boolean((item as BinItem).id),
        )
        .slice(0, 100)
    : null;
  const items = batchItems ?? singleItem;
  if (!items?.length)
    return NextResponse.json({ error: "At least one Bin item is required." }, { status: 400 });

  try {
    await assertPurgeAllowed(user.id);
    if (items.length === 1 && singleItem) {
      const { filesRemoved } = await permanentlyDeleteItem(items[0]);
      return NextResponse.json({ ok: true, filesRemoved });
    }
    return NextResponse.json({ ok: true, results: await deleteItemsWithConcurrency(items) });
  } catch (error: unknown) {
    const message = errorMessage(error, "Item could not be permanently deleted.");
    return NextResponse.json(
      { error: message },
      {
        status:
          message ===
          "Only directors and developers can permanently delete CRM Bin items."
            ? 403
            : 400,
      },
    );
  }
}
