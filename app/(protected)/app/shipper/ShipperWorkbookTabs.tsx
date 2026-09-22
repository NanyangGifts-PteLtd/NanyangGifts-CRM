"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ShipmentGrid, type ShipmentRecord } from "./ShipmentGrid";

const SpreadsheetPilot = dynamic(
  () => import("./SpreadsheetPilot").then((module) => module.SpreadsheetPilot),
  { ssr: false },
);

export function ShipperWorkbookTabs({ shipperId }: { shipperId: string }) {
  const [view, setView] = useState<"shipments" | "spreadsheet">("spreadsheet");
  const [shipments, setShipments] = useState<ShipmentRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (view !== "shipments" || shipments) return;
    void fetch(`/api/shipper/shipments?shipperId=${encodeURIComponent(shipperId)}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not load shipments.");
        setShipments(result.shipments ?? []);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Could not load shipments."));
  }, [shipperId, shipments, view]);
  return <><div className="mb-3 flex gap-2"><button onClick={() => setView("spreadsheet")} className={`rounded px-2 py-1 text-xs ${view === "spreadsheet" ? "bg-sky-600 text-white" : "border"}`}>Workbook</button><button onClick={() => setView("shipments")} className={`rounded px-2 py-1 text-xs ${view === "shipments" ? "bg-sky-600 text-white" : "border"}`}>Current shipments</button></div>{view === "shipments" ? error ? <p className="text-sm text-red-600">{error}</p> : shipments === null ? <p className="text-sm text-slate-500">Loading shipments…</p> : <ShipmentGrid shipments={shipments} mode="shipper" /> : <SpreadsheetPilot shipperId={shipperId} mode="shipper" />}</>;
}
