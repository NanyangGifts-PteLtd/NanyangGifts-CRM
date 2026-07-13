import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function getSupplierByToken(token: string) {
    const { data, error } = await supabaseAdmin
        .from("suppliers")
        .select("id, name, token")
        .eq("token", token)
        .maybeSingle();

    if (error) throw error;
    return data;
}