import { notFound } from "next/navigation";
import { getShipperByToken } from "@/lib/shipper/get-shipper-by-token";
import { getShipperSubitems } from "@/lib/shipper/get-shipper-subitems";
import ShipperGrid from "./ShipperGrid";

export default async function ShipperPage({
    params,
}: {
    params: Promise<{ token: string }>;
}) {
    const { token } = await params;

    const shipper = await getShipperByToken(token);
    if (!shipper) notFound();

    const rows = await getShipperSubitems(shipper.id);

    return (
        <main className="p-4">
            <h1 className="mb-4 text-lg font-semibold">{shipper.name}</h1>
            <ShipperGrid rows={rows} mode="shipper" token={token} />
        </main>
    );
}