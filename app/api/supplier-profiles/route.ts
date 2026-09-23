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
      .select("id, name, is_blacklisted, blacklisted_at, created_at")
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

  const [supplierResult, subitemsResult, productsResult, remarksResult] =
    await Promise.all([
      supabaseAdmin
        .from("supplier_profiles")
        .select("id, name, is_blacklisted, blacklisted_at, created_at")
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
    ]);
  if (supplierResult.error || !supplierResult.data)
    return NextResponse.json(
      { error: supplierResult.error?.message ?? "Supplier not found." },
      { status: 404 },
    );
  if (subitemsResult.error || productsResult.error || remarksResult.error)
    return NextResponse.json(
      {
        error:
          subitemsResult.error?.message ??
          productsResult.error?.message ??
          remarksResult.error?.message,
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
  if (body.isBlacklisted !== undefined) {
    changes.is_blacklisted = body.isBlacklisted === true;
    changes.blacklisted_at =
      body.isBlacklisted === true ? new Date().toISOString() : null;
    changes.blacklisted_by = body.isBlacklisted === true ? user.id : null;
  }
  const { data, error } = await supabaseAdmin
    .from("supplier_profiles")
    .update(changes)
    .eq("id", id)
    .select("id, name, is_blacklisted, blacklisted_at, created_at")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (body.name !== undefined)
    await supabaseAdmin
      .from("subitems")
      .update({ supplier: data.name })
      .eq("supplier_profile_id", id);
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
  return NextResponse.json(
    { error: "Unknown delete action." },
    { status: 400 },
  );
}
