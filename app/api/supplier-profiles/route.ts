import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const roles = new Set(["sales", "pm", "admin", "director", "dev"]);
const normalize = (value: unknown) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

async function actor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();
  return roles.has(String(data?.role ?? "").toLowerCase())
    ? { id: user.id, name: data?.full_name ?? "User" }
    : null;
}

export async function GET(request: NextRequest) {
  const user = await actor();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    const { data, error } = await supabaseAdmin
      .from("supplier_profiles")
      .select("id, name, is_blacklisted, is_starred, blacklisted_at, created_at")
      .order("name");
    return error
      ? NextResponse.json({ error: error.message }, { status: 500 })
      : NextResponse.json({ suppliers: data ?? [] });
  }

  // Lead details are only needed after a user opens one product's dialog.
  // Keeping them out of the profile payload prevents large suppliers from
  // blocking the initial profile view.
  const productName = request.nextUrl.searchParams.get("productName");
  if (productName) {
    const { data: linked, error: linkedError } = await supabaseAdmin
      .from("subitems")
      .select("client_id")
      .eq("supplier_profile_id", id)
      .eq("name", productName)
      .is("deleted_at", null);
    if (linkedError)
      return NextResponse.json({ error: linkedError.message }, { status: 500 });
    const clientIds = [...new Set((linked ?? []).map((item) => item.client_id))];
    const { data: leads, error: leadsError } = clientIds.length
      ? await supabaseAdmin
          .from("clients")
          .select("id, name, display_id")
          .in("id", clientIds)
      : { data: [], error: null };
    return leadsError
      ? NextResponse.json({ error: leadsError.message }, { status: 500 })
      : NextResponse.json({ leads: leads ?? [] });
  }

  const [supplierResult, subitemsResult, productsResult, remarksResult, tagsResult, optionsResult] =
    await Promise.all([
      supabaseAdmin
        .from("supplier_profiles")
        .select("id, name, contact, is_blacklisted, is_starred, blacklisted_at, created_at")
        .eq("id", id)
        .maybeSingle(),
      supabaseAdmin
        .from("subitems")
        .select("id, name, client_id")
        .eq("supplier_profile_id", id)
        .is("deleted_at", null)
        .order("name"),
      supabaseAdmin
        .from("supplier_profile_products")
        .select("id, name, normalized_name, is_hidden")
        .eq("supplier_profile_id", id)
        .order("name"),
      supabaseAdmin
        .from("supplier_profile_remarks")
        .select("id, content, created_at, author:profiles(full_name, email)")
        .eq("supplier_profile_id", id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("supplier_profile_tags")
        .select("tag:supplier_tag_options(id, name, color, sort_order)")
        .eq("supplier_profile_id", id),
      supabaseAdmin
        .from("supplier_tag_options")
        .select("id, name, color, sort_order")
        .order("sort_order")
        .order("name"),
    ]);
  if (supplierResult.error || !supplierResult.data)
    return NextResponse.json(
      { error: supplierResult.error?.message ?? "Supplier not found." },
      { status: 404 },
    );
  if (subitemsResult.error || productsResult.error || remarksResult.error || tagsResult.error || optionsResult.error)
    return NextResponse.json(
      {
        error:
          subitemsResult.error?.message ??
          productsResult.error?.message ??
          remarksResult.error?.message ?? tagsResult.error?.message ?? optionsResult.error?.message,
      },
      { status: 500 },
    );

  const linked = subitemsResult.data ?? [];
  const liveByName = new Map<string, typeof linked>();
  for (const subitem of linked) {
    const key = normalize(subitem.name);
    if (key) liveByName.set(key, [...(liveByName.get(key) ?? []), subitem]);
  }
  const products = (productsResult.data ?? [])
    .filter((product) => !product.is_hidden)
    .map((product) => {
      const live = liveByName.get(product.normalized_name) ?? [];
      liveByName.delete(product.normalized_name);
      return {
        id: product.id,
        name: product.name,
        subitemCount: live.length,
      };
    });
  for (const [key, live] of liveByName)
    products.push({
      id: `crm:${key}`,
      name: live[0]?.name || "Unnamed subitem",
      subitemCount: live.length,
    });
  products.sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json({
    supplier: supplierResult.data,
    products,
    remarks: remarksResult.data ?? [],
    tags: (tagsResult.data ?? [])
      .flatMap((row: any) => Array.isArray(row.tag) ? row.tag : row.tag ? [row.tag] : [])
      .sort((a: { sort_order?: number }, b: { sort_order?: number }) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    tagOptions: optionsResult.data ?? [],
  });
}

export async function POST(request: NextRequest) {
  const user = await actor();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json()) as Record<string, unknown>;
  if (body.action === "remark") {
    const supplierId = String(body.supplierId ?? "");
    const content = String(body.content ?? "").trim();
    if (!supplierId || !content)
      return NextResponse.json(
        { error: "A supplier and remark are required." },
        { status: 400 },
      );
    const { data, error } = await supabaseAdmin
      .from("supplier_profile_remarks")
      .insert({ supplier_profile_id: supplierId, content, author_id: user.id })
      .select("id, content, created_at, author:profiles(full_name, email)")
      .single();
    return error
      ? NextResponse.json({ error: error.message }, { status: 500 })
      : NextResponse.json({ remark: data });
  }
  if (body.action === "product") {
    const supplierId = String(body.supplierId ?? "");
    const name = String(body.name ?? "").trim();
    if (!supplierId || !name)
      return NextResponse.json(
        { error: "A supplier and subitem name are required." },
        { status: 400 },
      );
    const { data: existing, error: lookupError } = await supabaseAdmin
      .from("supplier_profile_products")
      .select("id")
      .eq("supplier_profile_id", supplierId)
      .eq("normalized_name", normalize(name))
      .maybeSingle();
    if (lookupError)
      return NextResponse.json({ error: lookupError.message }, { status: 500 });
    const query = existing
      ? supabaseAdmin
          .from("supplier_profile_products")
          .update({
            name,
            is_hidden: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
      : supabaseAdmin
          .from("supplier_profile_products")
          .insert({
            supplier_profile_id: supplierId,
            name,
            created_by: user.id,
          });
    const { data, error } = await query.select("id, name").single();
    return error
      ? NextResponse.json({ error: error.message }, { status: 500 })
      : NextResponse.json({ product: data });
  }
  if (body.action === "tag-option") {
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Tag name is required." }, { status: 400 });
    const { data: lastTag } = await supabaseAdmin
      .from("supplier_tag_options")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data, error } = await supabaseAdmin.from("supplier_tag_options")
      .insert({ name, created_by: user.id, sort_order: (lastTag?.sort_order ?? -1) + 1 }).select("id, name, color, sort_order").single();
    return error
      ? NextResponse.json({ error: error.code === "23505" ? "This tag already exists." : error.message }, { status: error.code === "23505" ? 409 : 500 })
      : NextResponse.json({ tagOption: data }, { status: 201 });
  }
  const name = String(body.name ?? "").trim();
  if (!name)
    return NextResponse.json(
      { error: "Supplier name is required." },
      { status: 400 },
    );
  const { data, error } = await supabaseAdmin
    .from("supplier_profiles")
    .insert({ name, created_by: user.id })
    .select("id, name, is_blacklisted, blacklisted_at, created_at")
    .single();
  if (error)
    return NextResponse.json(
      {
        error:
          error.code === "23505"
            ? "A supplier profile with this name already exists."
            : error.message,
      },
      { status: error.code === "23505" ? 409 : 500 },
    );
  return NextResponse.json({ supplier: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const user = await actor();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json()) as Record<string, unknown>;
  if (body.action === "toggle-supplier-tag") {
    const supplierId = String(body.supplierId ?? "");
    const tagId = String(body.tagId ?? "");
    if (!supplierId || !tagId)
      return NextResponse.json({ error: "Supplier and tag are required." }, { status: 400 });
    const selected = body.selected === true;
    const { error } = selected
      ? await supabaseAdmin.from("supplier_profile_tags").upsert(
          { supplier_profile_id: supplierId, tag_id: tagId, created_by: user.id },
          { onConflict: "supplier_profile_id,tag_id", ignoreDuplicates: true },
        )
      : await supabaseAdmin
          .from("supplier_profile_tags")
          .delete()
          .eq("supplier_profile_id", supplierId)
          .eq("tag_id", tagId);
    return error
      ? NextResponse.json({ error: error.message }, { status: 500 })
      : NextResponse.json({ selected });
  }
  if (body.action === "tag-option") {
    const tagId = String(body.id ?? "");
    if (!tagId) return NextResponse.json({ error: "Tag is required." }, { status: 400 });
    const changes: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) changes.name = String(body.name ?? "").trim();
    if (body.color !== undefined) changes.color = String(body.color ?? "").trim();
    const { data, error } = await supabaseAdmin.from("supplier_tag_options")
      .update(changes).eq("id", tagId).select("id, name, color, sort_order").single();
    return error
      ? NextResponse.json({ error: error.code === "23505" ? "This tag already exists." : error.message }, { status: error.code === "23505" ? 409 : 500 })
      : NextResponse.json({ tagOption: data });
  }
  if (body.action === "reorder-tag-options") {
    const tagIds = Array.isArray(body.tagIds)
      ? body.tagIds.filter((value): value is string => typeof value === "string")
      : [];
    if (!tagIds.length) return NextResponse.json({ error: "Tags are required." }, { status: 400 });
    const results = await Promise.all(tagIds.map((tagId, sortOrder) =>
      supabaseAdmin.from("supplier_tag_options").update({ sort_order: sortOrder, updated_at: new Date().toISOString() }).eq("id", tagId),
    ));
    const failed = results.find((result) => result.error);
    return failed?.error
      ? NextResponse.json({ error: failed.error.message }, { status: 500 })
      : NextResponse.json({ reordered: true });
  }
  const id = String(body.id ?? "");
  if (!id)
    return NextResponse.json(
      { error: "Supplier is required." },
      { status: 400 },
    );
  const changes: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (body.name !== undefined) changes.name = String(body.name).trim();
  if (body.contact !== undefined) changes.contact = String(body.contact ?? "");
  if (body.isBlacklisted !== undefined) {
    changes.is_blacklisted = body.isBlacklisted === true;
    changes.blacklisted_at =
      body.isBlacklisted === true ? new Date().toISOString() : null;
    changes.blacklisted_by = body.isBlacklisted === true ? user.id : null;
  }
  if (body.isStarred !== undefined) {
    changes.is_starred = body.isStarred === true;
    changes.starred_at = body.isStarred === true ? new Date().toISOString() : null;
    changes.starred_by = body.isStarred === true ? user.id : null;
  }
  const { data, error } = await supabaseAdmin
    .from("supplier_profiles")
    .update(changes)
    .eq("id", id)
    .select("id, name, contact, is_blacklisted, is_starred, blacklisted_at, created_at")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (body.name !== undefined)
    await supabaseAdmin
      .from("subitems")
      .update({ supplier: data.name })
      .eq("supplier_profile_id", id);
  if (Array.isArray(body.tagIds)) {
    const tagIds = [...new Set(body.tagIds.filter((value): value is string => typeof value === "string" && Boolean(value)))];
    const { error: clearError } = await supabaseAdmin.from("supplier_profile_tags").delete().eq("supplier_profile_id", id);
    if (clearError) return NextResponse.json({ error: clearError.message }, { status: 500 });
    if (tagIds.length) {
      const { error: tagError } = await supabaseAdmin.from("supplier_profile_tags").insert(tagIds.map((tagId) => ({ supplier_profile_id: id, tag_id: tagId, created_by: user.id })));
      if (tagError) return NextResponse.json({ error: tagError.message }, { status: 500 });
    }
  }
  return NextResponse.json({ supplier: data });
}

export async function DELETE(request: NextRequest) {
  const user = await actor();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json()) as Record<string, unknown>;
  const action = String(body.action ?? "");
  if (action === "supplier") {
    const { error } = await supabaseAdmin
      .from("supplier_profiles")
      .delete()
      .eq("id", String(body.id ?? ""));
    return error
      ? NextResponse.json({ error: error.message }, { status: 500 })
      : NextResponse.json({ deleted: true });
  }
  if (action === "remark") {
    const { error } = await supabaseAdmin
      .from("supplier_profile_remarks")
      .delete()
      .eq("id", String(body.id ?? ""))
      .eq("supplier_profile_id", String(body.supplierId ?? ""));
    return error
      ? NextResponse.json({ error: error.message }, { status: 500 })
      : NextResponse.json({ deleted: true });
  }
  if (action === "product") {
    const supplierId = String(body.supplierId ?? "");
    const id = String(body.id ?? "");
    const { data: product, error: productError } = await supabaseAdmin
      .from("supplier_profile_products")
      .select("id, normalized_name")
      .eq("id", id)
      .eq("supplier_profile_id", supplierId)
      .maybeSingle();
    if (productError)
      return NextResponse.json(
        { error: productError.message },
        { status: 500 },
      );
    const { data: linked, error: linkedError } = await supabaseAdmin
      .from("subitems")
      .select("name")
      .eq("supplier_profile_id", supplierId)
      .is("deleted_at", null);
    if (linkedError)
      return NextResponse.json({ error: linkedError.message }, { status: 500 });
    const productName = String(body.name ?? "").trim();
    const normalizedName = product?.normalized_name ?? normalize(productName);
    if (!normalizedName)
      return NextResponse.json(
        { error: "Subitem was not found." },
        { status: 404 },
      );
    const activeCount = (linked ?? []).filter(
      (subitem) => normalize(subitem.name) === normalizedName,
    ).length;
    const { error } = !product
      ? await supabaseAdmin
          .from("supplier_profile_products")
          .insert({
            supplier_profile_id: supplierId,
            name: productName || normalizedName,
            is_hidden: true,
            created_by: user.id,
          })
      : activeCount
        ? await supabaseAdmin
            .from("supplier_profile_products")
            .update({ is_hidden: true, updated_at: new Date().toISOString() })
            .eq("id", id)
        : await supabaseAdmin
            .from("supplier_profile_products")
            .delete()
            .eq("id", id);
    return error
      ? NextResponse.json({ error: error.message }, { status: 500 })
      : NextResponse.json({ deleted: true, activeCount });
  }
  if (action === "tag-option") {
    const { error } = await supabaseAdmin.from("supplier_tag_options").delete().eq("id", String(body.id ?? ""));
    return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ deleted: true });
  }
  return NextResponse.json(
    { error: "Unknown delete action." },
    { status: 400 },
  );
}
