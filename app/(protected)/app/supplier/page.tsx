import { getSupplierSubitems } from "@/lib/supplier/get-supplier-subitems";
import SupplierGrid from './[token]/SupplierGrid';

export default async function SupplierMasterPage() {
    try {
    const rows = await getSupplierSubitems();

    return (
        <main className="p-4">
            <h1 className="mb-4 text-lg font-semibold">All Suppliers — PM Master View</h1>
            <SupplierGrid rows={rows} />
        </main>
    );
} catch (e) {
        console.error('full error:', JSON.stringify(e, null, 2));
        throw e;
    }
}