import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { canEditClient } from "@/lib/client-access";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

async function isPmUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return String(profile?.role ?? "").trim().toLowerCase() === "pm";
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (await isPmUser(supabase, user.id)) {
      return NextResponse.json(
        { error: "PM users can view and print OCFs but cannot edit them." },
        { status: 403 },
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const clientId = formData.get("clientId") as string | null;
    const subitemId = formData.get("subitemId") as string | null;

    if (!file || !clientId || !subitemId) {
      return NextResponse.json(
        { error: "Missing file, clientId, or subitemId" },
        { status: 400 },
      );
    }
    if (!(await canEditClient(supabase, clientId, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: subitem, error: subitemError } = await supabase
      .from("subitems")
      .select("id")
      .eq("id", subitemId)
      .eq("client_id", clientId)
      .maybeSingle();
    if (subitemError) throw subitemError;
    if (!subitem) {
      return NextResponse.json(
        { error: "Subitem does not belong to this client" },
        { status: 400 },
      );
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Images must be 5 MB or smaller" },
        { status: 400 },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = file.name.split(".").pop() || "png";
    const path = `ocf-items/${clientId}/${subitemId}/${randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("order-confirmation-files")
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, path });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Unexpected server error" },
      { status: 500 },
    );
  }
}
