import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Field = "phone" | "company";

const normalizePhone = (value: string) => value.replace(/\D/g, "");
const normalizeCompany = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, " ");

function levenshtein(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= right.length; column += 1) {
      const above = previous[column];
      previous[column] = Math.min(previous[column] + 1, previous[column - 1] + 1, diagonal + (left[row - 1] === right[column - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return previous[right.length];
}

async function auth() {
  const supabase = await createClient();
  return (await supabase.auth.getUser()).data.user;
}

async function currentLink(clientId: string, field: Field, oldValue: string) {
  const column = field === "phone" ? "client_profile_id" : "company_profile_id";
  const { data: link } = await supabaseAdmin.from("customer_profile_lead_links").select(column).eq("client_id", clientId).maybeSingle();
  const linkedId = link?.[column as keyof typeof link] as string | null | undefined;
  if (linkedId) return linkedId;
  if (!oldValue.trim()) return null;
  if (field === "phone") {
    const normalized = normalizePhone(oldValue);
    const { data } = await supabaseAdmin.from("customer_client_profile_phone_numbers").select("client_profile_id").eq("normalized_phone", normalized).maybeSingle();
    return data?.client_profile_id ?? null;
  }
  const { data } = await supabaseAdmin.from("customer_company_profiles").select("id, name");
  return data?.find((profile) => normalizeCompany(profile.name) === normalizeCompany(oldValue))?.id ?? null;
}

async function exactMatch(field: Field, value: string) {
  if (field === "phone") {
    const { data } = await supabaseAdmin.from("customer_client_profile_phone_numbers").select("client_profile_id").eq("normalized_phone", normalizePhone(value)).maybeSingle();
    return data?.client_profile_id ?? null;
  }
  const { data } = await supabaseAdmin.from("customer_company_profiles").select("id, name");
  return data?.find((profile) => normalizeCompany(profile.name) === normalizeCompany(value))?.id ?? null;
}

async function link(clientId: string, field: Field, profileId: string, userId: string) {
  const column = field === "phone" ? "client_profile_id" : "company_profile_id";
  const { error } = await supabaseAdmin.from("customer_profile_lead_links").upsert({ client_id: clientId, [column]: profileId, updated_by: userId, updated_at: new Date().toISOString() }, { onConflict: "client_id" });
  if (error) throw error;
}

async function createAndLink(clientId: string, field: Field, value: string, clientName: string, userId: string) {
  if (field === "company") {
    const { data, error } = await supabaseAdmin.from("customer_company_profiles").insert({ name: value.trim(), created_by: userId }).select("id").single();
    if (error) throw error;
    await link(clientId, field, data.id, userId);
    return data.id;
  }
  const { data, error } = await supabaseAdmin.from("customer_client_profiles").insert({ name: clientName.trim() || "Unnamed client", phone_number: value.trim(), created_by: userId }).select("id").single();
  if (error) throw error;
  const { error: phoneError } = await supabaseAdmin.rpc("replace_customer_client_profile_phone_numbers", { target_profile_id: data.id, phone_entries: [{ phoneNumber: value.trim(), isPrimary: true }] });
  if (phoneError) { await supabaseAdmin.from("customer_client_profiles").delete().eq("id", data.id); throw phoneError; }
  await link(clientId, field, data.id, userId);
  return data.id;
}

export async function POST(request: NextRequest) {
  const user = await auth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const clientId = String(body.clientId ?? "");
  const field = String(body.field ?? "") as Field;
  const value = String(body.value ?? "").trim();
  const oldValue = String(body.oldValue ?? "").trim();
  if (!clientId || !["phone", "company"].includes(field) || !value || (field === "phone" && !normalizePhone(value))) return NextResponse.json({ error: "A valid client, field, and value are required." }, { status: 400 });

  const [{ data: client }, { data: assignment }] = await Promise.all([
    supabaseAdmin.from("clients").select("custom_fields").eq("id", clientId).maybeSingle(),
    supabaseAdmin.from("client_assignees").select("client_id").eq("client_id", clientId).eq("user_id", user.id).maybeSingle(),
  ]);
  const rawPmIds = client?.custom_fields && typeof client.custom_fields === "object" ? (client.custom_fields as Record<string, unknown>).pmAssigneeIds : null;
  let pmIds: string[] = [];
  try { pmIds = Array.isArray(rawPmIds) ? rawPmIds.map(String) : typeof rawPmIds === "string" ? JSON.parse(rawPmIds) : []; } catch { pmIds = []; }
  if (!client || (!assignment && !pmIds.includes(user.id))) return NextResponse.json({ error: "You can only edit items that are assigned to you." }, { status: 403 });

  const linkedProfileId = await currentLink(clientId, field, oldValue);
  const exactProfileId = await exactMatch(field, value);
  if (body.operation === "preview") {
    let exactProfile: { id: string; name: string } | null = null;
    if (exactProfileId) {
      const table = field === "phone" ? "customer_client_profiles" : "customer_company_profiles";
      const { data } = await supabaseAdmin.from(table).select("id, name").eq("id", exactProfileId).maybeSingle();
      exactProfile = data ?? null;
    }
    let suggestions: Array<{ id: string; name: string; similarity: number }> = [];
    if (field === "company" && !exactProfileId) {
      const needle = normalizeCompany(value);
      const { data } = await supabaseAdmin.from("customer_company_profiles").select("id, name");
      suggestions = (data ?? []).map((profile) => ({ ...profile, similarity: 1 - levenshtein(needle, normalizeCompany(profile.name)) / Math.max(needle.length, normalizeCompany(profile.name).length, 1) })).filter((profile) => profile.similarity >= 0.3).sort((a, b) => b.similarity - a.similarity).slice(0, 5);
    }
    return NextResponse.json({ linkedProfileId, exactProfileId, exactProfile, suggestions });
  }

  const action = String(body.action ?? "");
  const chosenProfileId = String(body.profileId ?? "");
  try {
    if ((action === "same_add" || action === "same_correct") && exactProfileId && exactProfileId !== linkedProfileId) {
      return NextResponse.json({ error: "This value already belongs to another customer profile. It cannot be added to the currently linked profile." }, { status: 409 });
    }
    if (action === "link" && chosenProfileId) await link(clientId, field, chosenProfileId, user.id);
    else if (action === "different") {
      if (exactProfileId) await link(clientId, field, exactProfileId, user.id);
      else await createAndLink(clientId, field, value, String(body.clientName ?? ""), user.id);
    } else if ((action === "same_add" || action === "same_correct") && !linkedProfileId) {
      await createAndLink(clientId, field, value, String(body.clientName ?? ""), user.id);
    } else if ((action === "same_add" || action === "same_correct") && field === "phone" && linkedProfileId) {
      const { data: phones, error } = await supabaseAdmin.from("customer_client_profile_phone_numbers").select("phone_number, is_primary").eq("client_profile_id", linkedProfileId).order("created_at");
      if (error) throw error;
      let entries = (phones ?? []).map((phone) => ({ phoneNumber: phone.phone_number, isPrimary: phone.is_primary }));
      if (action === "same_correct") entries = entries.filter((phone) => normalizePhone(phone.phoneNumber) !== normalizePhone(oldValue));
      entries = entries.map((phone) => ({ ...phone, isPrimary: false }));
      entries.push({ phoneNumber: value, isPrimary: true });
      const unique = Array.from(new Map(entries.map((entry) => [normalizePhone(entry.phoneNumber), entry])).values());
      const { error: replaceError } = await supabaseAdmin.rpc("replace_customer_client_profile_phone_numbers", { target_profile_id: linkedProfileId, phone_entries: unique });
      if (replaceError) throw replaceError;
      await link(clientId, field, linkedProfileId, user.id);
    } else if (action === "same_correct" && field === "company" && linkedProfileId) {
      const { error } = await supabaseAdmin.from("customer_company_profiles").update({ name: value }).eq("id", linkedProfileId);
      if (error) throw error;
      await link(clientId, field, linkedProfileId, user.id);
    } else return NextResponse.json({ error: "Invalid matching action." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update the customer profile link.";
    return NextResponse.json({ error: message.includes("unique") ? "That phone number or company is already assigned to another profile." : message }, { status: 409 });
  }
}
