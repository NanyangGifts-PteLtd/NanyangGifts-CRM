import { getShipperSubitems } from "@/lib/shipper/get-shipper-subitems";
import { getShippers } from "@/lib/shipper/get-shipper-by-token";
import { ShipperMasterSheets } from "./ShipperMasterSheets";
import { getShipperStagingRows } from "@/lib/shipper/get-shipper-staging-rows";
import { getShipperShipments } from "@/lib/shipper/shipments";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ShipperMasterPage() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) redirect("/auth/login?next=/app/shipper");
        const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();
        if (!["pm", "admin", "director", "dev"].includes(profile?.role?.toLowerCase() ?? "")) {
            redirect("/app");
        }
        const [rows, shippers, stagingRows, shipments] = await Promise.all([
            getShipperSubitems(),
            getShippers(),
            getShipperStagingRows(),
            getShipperShipments(),
        ]);
        const requestedShipperOrder = ["Tiger", "小李", "A5 汇荣"];
        const orderedShippers = requestedShipperOrder
            .map((name) => shippers.find((shipper) => shipper.name?.trim() === name))
            .filter((shipper): shipper is NonNullable<typeof shipper> => Boolean(shipper));

        return (
            <main className="p-4">
                <h1 className="mb-4 text-lg font-semibold">PM Master View</h1>
                <ShipperMasterSheets shippers={orderedShippers} rows={rows} stagingRows={stagingRows} shipments={shipments} />
            </main>
        );
    } catch (e) {
        console.error("full error:", e);
        throw e;
    }
}
