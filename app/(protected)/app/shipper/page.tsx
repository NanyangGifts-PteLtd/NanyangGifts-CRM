import { getShipperSubitems } from "@/lib/shipper/get-shipper-subitems";
import { getShippers } from "@/lib/shipper/get-shipper-by-token";
import ShipperGrid from "./[token]/ShipperGrid";

export default async function ShipperMasterPage() {
    try {
        const [rows, shippers] = await Promise.all([
            getShipperSubitems(),
            getShippers(),
        ]);
        const requestedShipperOrder = ["Tiger", "小李", "A5 汇荣"];
        const orderedShippers = requestedShipperOrder
            .map((name) => shippers.find((shipper) => shipper.name?.trim() === name))
            .filter((shipper): shipper is NonNullable<typeof shipper> => Boolean(shipper));

        return (
            <main className="p-4">
                <h1 className="mb-4 text-lg font-semibold">PM Master View</h1>
                <div className="space-y-8">
                    {orderedShippers.map((shipper) => (
                        <section key={shipper.id}>
                            <h2 className="mb-3 text-base font-semibold text-slate-700">{shipper.name}</h2>
                            <ShipperGrid
                                rows={rows.filter((row) => row.shipper_id === shipper.id)}
                                mode="pm"
                            />
                        </section>
                    ))}
                </div>
            </main>
        );
    } catch (e) {
        console.error("full error:", e);
        throw e;
    }
}