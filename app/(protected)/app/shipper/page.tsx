import { getShipperSubitems } from "@/lib/shipper/get-shipper-subitems";
import { getShippers } from "@/lib/shipper/get-shipper-by-token";
import { ShipperMasterSheets } from "./ShipperMasterSheets";
import { getShipperStagingRows } from "@/lib/shipper/get-shipper-staging-rows";
import { getShipperShipments } from "@/lib/shipper/shipments";

export default async function ShipperMasterPage() {
    try {
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
