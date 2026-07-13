import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function getSupplierSubitems(supplierId: string) {
    const { data, error } = await supabaseAdmin
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
        .eq("supplier_id", supplierId)
        .order("id", { ascending: false });

    if (error) throw error;
    return data ?? [];
}