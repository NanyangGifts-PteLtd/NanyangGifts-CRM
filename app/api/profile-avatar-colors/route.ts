import { NextResponse } from "next/server";
import { isAvatarColor } from "@/lib/avatar-colors";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const MANAGER_ROLES = new Set(["admin", "director", "dev"]);

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: actor, error: actorError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (
    actorError ||
    !MANAGER_ROLES.has(String(actor?.role ?? "").toLowerCase())
  ) {
    return NextResponse.json(
      { error: "Only admins, directors, and dev users can change user colours." },
      { status: 403 },
    );
  }

  const body = (await request.json()) as {
    userId?: unknown;
    avatarColor?: unknown;
  };
  if (typeof body.userId !== "string" || !body.userId.trim()) {
    return NextResponse.json({ error: "A user is required." }, { status: 400 });
  }
  if (body.avatarColor !== null && !isAvatarColor(body.avatarColor)) {
    return NextResponse.json({ error: "Choose a colour from the available palette." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ avatar_color: body.avatarColor })
    .eq("id", body.userId)
    .select("id, avatar_color")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ profile: data });
}
