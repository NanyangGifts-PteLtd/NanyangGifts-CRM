"use client";

import { useState } from "react";
import ShipperGrid, { type ShipperRow } from "./[token]/ShipperGrid";
import { ShipperStagingTable } from "./ShipperStagingTable";
import type { ShipperStagingRow } from "@/lib/shipper/get-shipper-staging-rows";

type Shipper = { id: string; name: string | null };

export function ShipperMasterSheets({ shippers, rows, stagingRows }: { shippers: Shipper[]; rows: ShipperRow[]; stagingRows: ShipperStagingRow[] }) {
    const [activeShipperId, setActiveShipperId] = useState(shippers[0]?.id ?? "");
    const [gridRows, setGridRows] = useState(rows);
    const [stagedRows, setStagedRows] = useState(stagingRows);
    const activeShipper = shippers.find((shipper) => shipper.id === activeShipperId) ?? shippers[0];

    if (!activeShipper) return <div className="rounded border border-slate-200 bg-white p-6 text-sm text-slate-500">No shippers configured.</div>;

    return <div className="flex min-h-0 flex-1 flex-col rounded-md border border-slate-300 bg-white shadow-sm">
        <div className="min-h-0 flex-1 overflow-auto">
            <ShipperGrid rows={gridRows.filter((row) => row.shipper_id === activeShipper.id)} mode="pm" />
            <ShipperStagingTable key={activeShipper.id} shipper={activeShipper} initialRows={stagedRows.filter((row) => row.shipper_id === activeShipper.id)} onRowsChange={(next) => setStagedRows((current) => [...current.filter((row) => row.shipper_id !== activeShipper.id), ...next])} onPushed={(row) => setGridRows((current) => { const exists = current.some((item) => item.subitem_id === row.subitem_id); return exists ? current.map((item) => item.subitem_id === row.subitem_id ? row : item) : [...current, row]; })} />
        </div>
        <div className="fixed bottom-0 left-0 z-40 flex items-end gap-2 border-t border-r border-slate-300 bg-slate-50 px-3 pt-3 shadow-[0_-2px_8px_rgba(15,23,42,0.08)]">
            {shippers.map((shipper) => <button key={shipper.id} type="button" onClick={() => setActiveShipperId(shipper.id)} className={`rounded-t-md border px-6 py-3 text-sm font-semibold transition ${shipper.id === activeShipper.id ? "border-slate-300 border-b-white bg-white text-sky-700" : "border-transparent text-slate-600 hover:bg-slate-100"}`}>{shipper.name || "Unnamed shipper"}</button>)}
        </div>
    </div>;
}
