import { getShipperSubitems } from "@/lib/shipper/get-shipper-subitems";
import { getShippers } from "@/lib/shipper/get-shipper-by-token";
import { ShipperMasterSheets } from "./ShipperMasterSheets";
import { getShipperStagingRows } from "@/lib/shipper/get-shipper-staging-rows";

export default async function ShipperMasterPage() {
    try {
        const [rows, shippers, stagingRows] = await Promise.all([
            getShipperSubitems(),
            getShippers(),
            getShipperStagingRows(),
        ]);
        const requestedShipperOrder = ["Tiger", "小李", "A5 汇荣"];
        const orderedShippers = requestedShipperOrder
            .map((name) => shippers.find((shipper) => shipper.name?.trim() === name))
            .filter((shipper): shipper is NonNullable<typeof shipper> => Boolean(shipper));

        return (
            <main className="p-4">
                <h1 className="mb-4 text-lg font-semibold">PM Master View</h1>
                <ShipperMasterSheets shippers={orderedShippers} rows={rows} stagingRows={stagingRows} />
            </main>
        );
    } catch (e) {
        console.error("full error:", e);
        throw e;
    }
}
