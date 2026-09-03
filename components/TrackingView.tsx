"use client";

import { Fragment, useMemo, useState } from "react";
import type { Client, CRMGroup, Profile } from "@/app/types";
import { EditableCell } from "@/components/ui/editablecell";
import { StatusBadge, type BadgeOption } from "@/components/ui/statusbadge";
import { AssigneeMultiSelect } from "@/components/ui/assignee-multiselect";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const summaryOptions: BadgeOption[] = [
  { value: "Started", color: "#ffae3d" },
  { value: "Successful", color: "#16a34a" },
  { value: "Delivered", color: "#9748d7" },
  { value: "Discussed", color: "#0ea5e9" },
  { value: "Variation", color: "#a855f7" },
];
const multipleInvoiceOptions: BadgeOption[] = [
  { value: "Yes", color: "#f59e0b" },
  { value: "No", color: "#64748b" },
];
const paymentStatusOptions: BadgeOption[] = [
  ["Not Delivered", "#ff5b57"],
  ["30days Credit terms", "#e63959"],
  ["NHG AP-Direct Done", "#5595f5"],
  ["To Fill Up", "#bfc0c2"],
  ["Submitted", "#f6c900"],
  ["Gebiz Done", "#008bc4"],
  ["Sesami Done", "#ed5acb"],
  ["Vendors@GOV Done", "#835446"],
  ["Chase for payment", "#c52a50"],
  ["Paypal Payment", "#008448"],
  ["Tenderboard Done", "#8bcf13"],
  ["PAID", "#00c976"],
  ["Ariba Done", "#2f75d6"],
  ["To Verify Issues", "#333333"],
  ["Partially PAID", "#ffae3d"],
  ["Coupa Done", "#5a5fd7"],
  ["Cardup", "#9748d7"],
  ["Partial Invoice", "#777777"],
  ["Chase for PO", "#ec087a"],
  ["Others (remarks)", "#54c2ed"],
].map(([value, color]) => ({ value, color })) as BadgeOption[];

type TrackingField =
  | "trackingSummary"
  | "trackingInvoiceNumber"
  | "trackingMultipleInvoices"
  | "trackingPaymentStatus";

function valueOf(client: Client, field: TrackingField) {
  return client.customFields?.[field] ?? "";
}

export function TrackingView({
  groups,
  clients,
  profiles,
  assigneeMap,
  selectedIds,
  onToggleSelect,
  onToggleGroupSelect,
  onUpdate,
  onChangeAssignees,
}: {
  groups: CRMGroup[];
  clients: Client[];
  profiles: Profile[];
  assigneeMap: Record<string, string[]>;
  selectedIds: Set<string>;
  onToggleSelect: (clientId: string) => void;
  onToggleGroupSelect: (clientIds: string[]) => void;
  onUpdate: (client: Client, updates: Partial<Client>) => void;
  onChangeAssignees: (clientId: string, ids: string[]) => void;
}) {
  const [invoicePromptClient, setInvoicePromptClient] = useState<Client | null>(
    null,
  );
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(
    new Set(),
  );
  const closedGroups = useMemo(
    () =>
      groups
        .filter((group) => /^closed leads\s*-\s*/i.test(group.name))
        .map((group) => ({
          group,
          clients: clients.filter((client) => client.groupId === group.id),
        }))
        .filter(({ clients: groupClients }) => groupClients.length),
    [groups, clients],
  );

  const updateTracking = (
    client: Client,
    field: TrackingField,
    value: string,
  ) => {
    onUpdate(client, {
      customFields: { ...(client.customFields ?? {}), [field]: value },
    });
  };
  const setMultipleInvoices = (value: "Yes" | "No") => {
    if (!invoicePromptClient) return;
    updateTracking(invoicePromptClient, "trackingMultipleInvoices", value);
    setInvoicePromptClient(null);
  };
  const toggleGroup = (groupId: string) =>
    setCollapsedGroupIds((current) => {
      const next = new Set(current);
      next.has(groupId) ? next.delete(groupId) : next.add(groupId);
      return next;
    });

  return (
    <div className="border-t border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-[1320px] w-full border-collapse text-[12.6px]">
          <tbody>
            {closedGroups.map(({ group, clients: groupClients }) => (
              <Fragment key={group.id}>
                <tr>
                  <td
                    colSpan={8}
                    className="border-b-2 border-slate-300 bg-slate-50 p-0"
                  >
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.id)}
                      className="flex min-h-[58px] w-full items-center gap-3 px-3 text-left"
                    >
                      <span className="text-base text-slate-500">
                        {collapsedGroupIds.has(group.id) ? "▷" : "▼"}
                      </span>
                      <span className="h-8 w-1.5 rounded bg-[#7BCBD5]" />
                      <span>
                        <span className="block text-lg font-semibold leading-6 text-slate-700">
                          {group.name}
                        </span>
                        <span className="block text-[13px] italic font-normal text-slate-500">
                          {groupClients.length}{" "}
                          {groupClients.length === 1 ? "Client" : "Clients"}
                        </span>
                      </span>
                    </button>
                  </td>
                </tr>
                {!collapsedGroupIds.has(group.id) && (
                  <tr className="h-8 bg-white text-center text-[12.6px] text-slate-600">
                    {[
                      "",
                      "Client",
                      "People",
                      "Summary",
                      "Channel",
                      "Invoice Number",
                      "Multiple Invoices?",
                      "Payment Status",
                    ].map((label, index) => (
                      <th
                        key={`${group.id}-${label || index}`}
                        className="border border-[#D0D4E4] px-2 font-medium"
                      >
                        {index === 0 ? (
                          <input
                            type="checkbox"
                            aria-label={`Select clients in ${group.name}`}
                            checked={groupClients.every((client) =>
                              selectedIds.has(client.id),
                            )}
                            onChange={() =>
                              onToggleGroupSelect(
                                groupClients.map((client) => client.id),
                              )
                            }
                            className="h-3 w-3 rounded accent-[#7BCBD5]"
                          />
                        ) : (
                          label
                        )}
                      </th>
                    ))}
                  </tr>
                )}
                {!collapsedGroupIds.has(group.id) &&
                  groupClients.map((client) => {
                    const invoiceNumber = valueOf(
                      client,
                      "trackingInvoiceNumber",
                    );
                    const multipleInvoices = valueOf(
                      client,
                      "trackingMultipleInvoices",
                    );
                    const missingMultipleInvoiceChoice = Boolean(
                      invoiceNumber && !multipleInvoices,
                    );
                    return (
                      <tr
                        key={client.id}
                        className="h-[38px] hover:bg-blue-50/30"
                      >
                        <td className="w-[60px] border border-[#D0D4E4] px-2 text-center">
                          <input
                            type="checkbox"
                            aria-label={`Select ${client.name}`}
                            checked={selectedIds.has(client.id)}
                            onChange={() => onToggleSelect(client.id)}
                            className="h-3 w-3 rounded accent-[#7BCBD5]"
                          />
                        </td>
                        <td className="w-[250px] border border-[#D0D4E4] px-2 font-medium">
                          <span className="mr-1 text-slate-400">›</span>
                          {client.name}
                        </td>
                        <td className="w-[90px] border border-[#D0D4E4] p-0">
                          <AssigneeMultiSelect
                            profiles={profiles}
                            selectedIds={assigneeMap[client.id] ?? []}
                            onChange={(ids) =>
                              onChangeAssignees(client.id, ids)
                            }
                          />
                        </td>
                        <td className="w-[130px] border border-[#D0D4E4] p-0">
                          <StatusBadge
                            value={valueOf(client, "trackingSummary")}
                            onChange={(value) =>
                              updateTracking(client, "trackingSummary", value)
                            }
                            options={summaryOptions}
                            manageLabel="tracking summary"
                          />
                        </td>
                        <td className="w-[130px] border border-[#D0D4E4] px-2">
                          {client.channel}
                        </td>
                        <td className="w-[180px] border border-[#D0D4E4] p-1">
                          <EditableCell
                            value={invoiceNumber}
                            onChange={(value) => {
                              updateTracking(
                                client,
                                "trackingInvoiceNumber",
                                value,
                              );
                              if (value.trim() && !multipleInvoices)
                                setInvoicePromptClient(client);
                            }}
                          />
                        </td>
                        <td
                          className={`w-[180px] p-0 ${missingMultipleInvoiceChoice ? "border-2 border-red-500 bg-red-50" : "border border-[#D0D4E4]"}`}
                        >
                          <StatusBadge
                            value={multipleInvoices}
                            onChange={(value) =>
                              updateTracking(
                                client,
                                "trackingMultipleInvoices",
                                value,
                              )
                            }
                            options={multipleInvoiceOptions}
                            manageLabel="multiple invoices"
                          />
                        </td>
                        <td className="w-[190px] border border-[#D0D4E4] p-0">
                          <StatusBadge
                            value={valueOf(client, "trackingPaymentStatus")}
                            onChange={(value) =>
                              updateTracking(
                                client,
                                "trackingPaymentStatus",
                                value,
                              )
                            }
                            options={paymentStatusOptions}
                            manageLabel="tracking payment status"
                          />
                        </td>
                      </tr>
                    );
                  })}
              </Fragment>
            ))}
          </tbody>
        </table>
        {!closedGroups.length && (
          <p className="p-8 text-center text-sm text-slate-500">
            No closed leads are available for tracking.
          </p>
        )}
      </div>
      <AlertDialog
        open={Boolean(invoicePromptClient)}
        onOpenChange={(open) => {
          if (!open) setInvoicePromptClient(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Multiple invoices?</AlertDialogTitle>
            <AlertDialogDescription>
              Does this closed lead have Multiple Invoices?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Decide later</AlertDialogCancel>
            <AlertDialogAction onClick={() => setMultipleInvoices("No")}>
              No
            </AlertDialogAction>
            <AlertDialogAction onClick={() => setMultipleInvoices("Yes")}>
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
