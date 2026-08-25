import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type ShipperStagingRow = { id: string; shipper_id: string; values: Record<string, string>; created_at: string; updated_at: string };

export async function getShipperStagingRows(): Promise<ShipperStagingRow[]> {
  const { data, error } = await supabaseAdmin.from("shipper_staging_rows").select("id, shipper_id, values, created_at, updated_at").order("created_at");
  if (error) throw error;
  return (data ?? []) as ShipperStagingRow[];
}
