import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type ShipperByToken = {
    id: string;
    name: string | null;
    token: string;
};

export async function getShipperByToken(token: string): Promise<ShipperByToken | null> {
    if (!token) return null;

    const { data, error } = await supabaseAdmin
        .from("shippers")
        .select("id, name, token")
        .eq("token", token)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data;
}