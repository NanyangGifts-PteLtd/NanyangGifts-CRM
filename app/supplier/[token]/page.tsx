"use client";

import { notFound } from "next/navigation";
import { getSupplierByToken } from "@/lib/supplier/get-supplier-by-token";
import { getSupplierSubitems } from "@/lib/supplier/get-supplier-subitems";
import SupplierGrid from "./SupplierGrid";

export const dynamic = "force-dynamic";

export default async function SupplierPage({
    params,
}: {
    params: Promise<{ token: string }>;
}) {
    const { token } = await params;

    const supplier = await getSupplierByToken(token);
    if (!supplier) notFound();

    const rows = await getSupplierSubitems(supplier.id);

    return (
        <main className="p-4">
            <h1 className="mb-4 text-lg font-semibold">{supplier.name}</h1>
            <SupplierGrid rows={rows} />
        </main>
    );
}