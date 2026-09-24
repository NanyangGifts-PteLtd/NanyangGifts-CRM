"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ExternalLink } from "lucide-react";

const SpreadsheetPilot = dynamic(
  () => import("./SpreadsheetPilot").then((module) => module.SpreadsheetPilot),
  { ssr: false },
);

type Shipper = { id: string; name: string | null; website_url?: string | null };
type Props = { shippers: Shipper[] };

export function ShipperMasterSheets({
  shippers,
}: Props) {
  const [activeShipperId, setActiveShipperId] = useState(shippers[0]?.id ?? "");
  const activeShipper =
    shippers.find((shipper) => shipper.id === activeShipperId) ?? shippers[0];

  if (!activeShipper)
    return (
      <div className="rounded border border-slate-200 bg-white p-6 text-sm text-slate-500">
        No shippers configured.
      </div>
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-md border border-slate-300 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-2.5">
        <div className="text-sm font-semibold text-slate-700">
          {activeShipper.name || "Unnamed shipper"}
        </div>
        <div className="flex gap-2">
          <span className="rounded bg-sky-600 px-2 py-1 text-xs text-white">
            Workbook
          </span>
          {activeShipper.website_url && (
            <a
              href={activeShipper.website_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100"
            >
              <ExternalLink size={13} />
              Open shipper website
            </a>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <SpreadsheetPilot key={activeShipper.id} shipperId={activeShipper.id} />
      </div>
      <div className="fixed bottom-0 left-0 z-40 flex items-end gap-2 border-t border-r border-slate-300 bg-slate-50 px-3 pt-3 shadow-[0_-2px_8px_rgba(15,23,42,0.08)]">
        {shippers.map((shipper) => (
          <button
            key={shipper.id}
            type="button"
            onClick={() => setActiveShipperId(shipper.id)}
            className={`rounded-t-md border px-6 py-3 text-sm font-semibold transition ${shipper.id === activeShipper.id ? "border-slate-300 border-b-white bg-white text-sky-700" : "border-transparent text-slate-600 hover:bg-slate-100"}`}
          >
            {shipper.name || "Unnamed shipper"}
          </button>
        ))}
      </div>
    </div>
  );
}
