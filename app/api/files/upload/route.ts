import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "crm-files";
const MAX_FILE_SIZE = 25 * 1024 * 1024;

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 80) || "file";
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  const scope = String(formData.get("scope") ?? "uploads");
  const clientId = String(formData.get("clientId") ?? "").trim();
  const subitemId = String(formData.get("subitemId") ?? "").trim();
  if (!(file instanceof File)) return NextResponse.json({ error: "A file is required" }, { status: 400 });
  if (!clientId) return NextResponse.json({ error: "A linked client is required" }, { status: 400 });
  if (!file.size) return NextResponse.json({ error: "The selected file is empty" }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Files must be 25 MB or smaller" }, { status: 400 });

  const extension = safeSegment(file.name.split(".").pop() || "bin");
  const cleanScope = scope.split("/").map(safeSegment).filter(Boolean).slice(0, 5).join("/");
  const storagePath = subitemId
    ? `subitems/${clientId}/${subitemId}/${cleanScope}/${user.id}/${randomUUID()}.${extension}`
    : `clients/${clientId}/${cleanScope}/${user.id}/${randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, Buffer.from(await file.arrayBuffer()), {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    file: {
      id: randomUUID(),
      name: file.name,
      mimeType: file.type || undefined,
      storagePath,
      url: `/api/files/download?path=${encodeURIComponent(storagePath)}`,
    },
  });
}
