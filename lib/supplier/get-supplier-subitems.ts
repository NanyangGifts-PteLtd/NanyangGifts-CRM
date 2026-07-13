import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function getSupplierSubitems(supplierId?: string) {
    let query = supabaseAdmin
        .from("subitems")
        .select(`
            id,
            name,
            qty,
            supplier,
            cost,
            ls,
            os,
            tc,
            uc,
            tc_sgd,
            price,
            up
        `)
        .order("id", { ascending: false });

    if (supplierId) {
        query = query.eq("supplier_id", supplierId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data ?? [];
}