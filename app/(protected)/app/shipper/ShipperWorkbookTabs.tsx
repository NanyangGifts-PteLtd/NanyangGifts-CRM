"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ShipmentGrid, type ShipmentRecord } from "./ShipmentGrid";

const SpreadsheetPilot = dynamic(
  () => import("./SpreadsheetPilot").then((module) => module.SpreadsheetPilot),
  { ssr: false },
);

export function ShipperWorkbookTabs({ shipperId, shipments }: { shipperId: string; shipments: ShipmentRecord[] }) {
  const [view, setView] = useState<"shipments" | "spreadsheet">("shipments");
  return <><div className="mb-3 flex gap-2"><button onClick={() => setView("shipments")} className={`rounded px-2 py-1 text-xs ${view === "shipments" ? "bg-sky-600 text-white" : "border"}`}>Current shipments</button><button onClick={() => setView("spreadsheet")} className={`rounded px-2 py-1 text-xs ${view === "spreadsheet" ? "bg-sky-600 text-white" : "border"}`}>Spreadsheet pilot</button></div>{view === "shipments" ? <ShipmentGrid shipments={shipments} mode="shipper" /> : <SpreadsheetPilot shipperId={shipperId} mode="shipper" />}</>;
}
