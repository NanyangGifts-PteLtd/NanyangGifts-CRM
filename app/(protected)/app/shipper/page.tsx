import { getShipperSubitems } from "@/lib/shipper/get-shipper-subitems";
import ShipperGrid from "./[token]/ShipperGrid";

export default async function ShipperMasterPage() {
    try {
        const rows = await getShipperSubitems();

        return (
            <main className="p-4">
                <h1 className="mb-4 text-lg font-semibold">PM Master View</h1>
                <ShipperGrid rows={rows} mode="pm" />
            </main>
        );
    } catch (e) {
        console.error("full error:", e);
        throw e;
    }
}