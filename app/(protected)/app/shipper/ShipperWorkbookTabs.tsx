"use client";

import dynamic from "next/dynamic";

const SpreadsheetPilot = dynamic(
  () => import("./SpreadsheetPilot").then((module) => module.SpreadsheetPilot),
  { ssr: false },
);

/**
 * Shipper users work exclusively in the workbook. The legacy shipment-table
 * navigation is intentionally not exposed from this view.
 */
export function ShipperWorkbookTabs({ shipperId }: { shipperId: string }) {
  return <SpreadsheetPilot shipperId={shipperId} mode="shipper" />;
}
