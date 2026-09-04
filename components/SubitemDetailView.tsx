"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Paperclip,
  X,
} from "lucide-react";
import type {
  ActivityEntry,
  Profile,
  SampleRow,
  Subitem,
  TimelineRow,
} from "@/app/types";
import { AssigneeMultiSelect, gradientForId } from "./ui/assignee-multiselect";
import { EditableCell } from "./ui/editablecell";
import { StatusBadge, type BadgeOption } from "./ui/statusbadge";
import { toast } from "sonner";
import { SubitemActionsMenu } from "./SubitemActionsMenu";
import { FileDropTarget } from "./ui/file-drop-target";
import { uploadCrmFiles } from "@/lib/crm-files";
import { FilePreview } from "./ui/file-preview";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

type Attachment = {
  id: string;
  name: string;
  url: string;
  storagePath?: string;
  mimeType?: string;
};
type Tab = "overview" | "files" | "activity";
const readFiles = (raw?: string): Attachment[] => {
  try {
    const parsed = JSON.parse(raw ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item?.url) : [];
  } catch {
    return [];
  }
};
const readSingleFile = (raw?: string): Attachment | null => {
  try {
    const parsed = JSON.parse(raw ?? "null");
    return Array.isArray(parsed)
      ? (parsed[0] ?? null)
      : parsed?.url
        ? parsed
        : null;
  } catch {
    return null;
  }
};
const formatValue = (value: unknown) =>
  value == null || value === ""
    ? "empty"
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
const dateValue = (value: string) => {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime())
    ? date.toISOString().slice(0, 10)
    : "";
};

export function SubitemDetailView({
  subitem,
  clientId,
  clientName,
  siblings,
  profiles,
  assigneeIds,
  canEdit,
  onClose,
  onNavigate,
  onUpdate,
  onAssigneesChange,
  activityLog,
  onUndo,
  options,
  moveTargetGroups,
  onDuplicate,
  onMove,
  onDelete,
}: {
  subitem: Subitem;
  clientId: string;
  clientName: string;
  siblings: Subitem[];
  profiles: Profile[];
  assigneeIds: string[];
  canEdit: boolean;
  onClose: () => void;
  onNavigate: (subitem: Subitem) => void;
  onUpdate: (updates: Partial<Subitem>) => void;
  onAssigneesChange: (ids: string[]) => void;
  activityLog: ActivityEntry[];
  onUndo: (entry: ActivityEntry) => void | Promise<void>;
  options: {
    status: BadgeOption[];
    localOverseas: BadgeOption[];
    shipper: BadgeOption[];
    currency: BadgeOption[];
    payment: BadgeOption[];
    paymentStatus: BadgeOption[];
    modeOfPayment: BadgeOption[];
    subProgress: BadgeOption[];
  };
  moveTargetGroups: Array<{
    name: string;
    clients: Array<{ id: string; name: string }>;
  }>;
  onDuplicate: () => void | Promise<void>;
  onMove: (clientId: string) => void | Promise<void>;
  onDelete: () => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [hoverName, setHoverName] = useState(false);
  const [notice, setNotice] = useState<{ left: number; top: number } | null>(
    null,
  );
  const [pendingSingleFileChange, setPendingSingleFileChange] = useState<{
    type: "remove" | "replace";
    key: "artworkFile" | "ocfFinalArtworkFile";
    title: string;
    incoming?: File;
  } | null>(null);
  const people = useMemo(
    () =>
      assigneeIds
        .map((id) => profiles.find((profile) => profile.id === id))
        .filter(Boolean) as Profile[],
    [assigneeIds, profiles],
  );
  const siblingIndex = siblings.findIndex((item) => item.id === subitem.id);
  const logs = activityLog
    .filter((entry) => entry.subitemId === subitem.id)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  const blocked = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setNotice({
      left: Math.min(rect.left, window.innerWidth - 300),
      top: Math.min(rect.bottom + 8, window.innerHeight - 52),
    });
  };
  const lock = (event: React.MouseEvent<HTMLElement>) => {
    if (canEdit) return;
    event.preventDefault();
    event.stopPropagation();
    blocked(event.currentTarget);
  };
  const text = (label: string, key: keyof Subitem) => (
    <label key={String(key)} className="text-sm font-medium text-slate-500">
      {label}
      <div
        onClickCapture={lock}
        className="mt-2 min-h-10 rounded border border-slate-200 bg-white"
      >
        <EditableCell
          readOnly={!canEdit}
          value={String(subitem[key] ?? "")}
          onChange={(value) => onUpdate({ [key]: value } as Partial<Subitem>)}
          className="min-h-[38px] px-2 text-sm"
        />
      </div>
    </label>
  );
  const badge = (label: string, key: keyof Subitem, values: BadgeOption[]) => (
    <div key={String(key)}>
      <label className="mb-2 block text-sm font-medium text-slate-500">
        {label}
      </label>
      <div
        onClickCapture={lock}
        className={`h-10 overflow-hidden rounded ${!canEdit ? "pointer-events-none opacity-70" : ""}`}
      >
        <StatusBadge
          value={String(subitem[key] ?? "")}
          onChange={(value) => onUpdate({ [key]: value } as Partial<Subitem>)}
          options={values}
        />
      </div>
    </div>
  );
  const updateTimeline = (
    rowIndex: number,
    key: keyof TimelineRow,
    value: string,
  ) =>
    onUpdate({
      timelineRows: (subitem.timelineRows ?? []).map((row, index) =>
        index === rowIndex ? { ...row, [key]: value } : row,
      ),
    });
  const updateSample = (
    rowIndex: number,
    key: keyof SampleRow,
    value: string,
  ) =>
    onUpdate({
      sampleRows: (subitem.sampleRows ?? []).map((row, index) =>
        index === rowIndex ? { ...row, [key]: value } : row,
      ),
    });
  const files = readFiles(subitem.customFields?.subitemFiles);
  const saveFiles = (next: Attachment[]) =>
    onUpdate({
      customFields: {
        ...(subitem.customFields ?? {}),
        subitemFiles: JSON.stringify(next),
      },
    });
  const artwork = readSingleFile(subitem.customFields?.artworkFile);
  const ocfFinalArtwork = readSingleFile(
    subitem.customFields?.ocfFinalArtworkFile,
  );
  const saveSingleFile = (
    key: "artworkFile" | "ocfFinalArtworkFile",
    file: Attachment | null,
  ) =>
    onUpdate({
      customFields: {
        ...(subitem.customFields ?? {}),
        [key]: file ? JSON.stringify(file) : "",
      },
    });
  const replaceSingleFile = (
    key: "artworkFile" | "ocfFinalArtworkFile",
    current: Attachment | null,
    incoming: File,
  ) => {
    if (current) {
      setPendingSingleFileChange({
        type: "replace",
        key,
        title: key === "artworkFile" ? "Artwork" : "OCF (Final Artwork)",
        incoming,
      });
      return;
    }
    void uploadCrmFiles(
      [incoming],
      `subitems/${subitem.id}/${key}`,
      { clientId, subitemId: subitem.id },
    ).then(
      ([file]) => saveSingleFile(key, file),
    );
  };
  const requestSingleFileRemoval = (
    key: "artworkFile" | "ocfFinalArtworkFile",
  ) =>
    setPendingSingleFileChange({
      type: "remove",
      key,
      title: key === "artworkFile" ? "Artwork" : "OCF (Final Artwork)",
    });
  const confirmSingleFileChange = () => {
    if (!pendingSingleFileChange) return;
    const { type, key, incoming } = pendingSingleFileChange;
    if (type === "remove") {
      saveSingleFile(key, null);
    } else if (incoming) {
      void uploadCrmFiles(
        [incoming],
        `subitems/${subitem.id}/${key}`,
        { clientId, subitemId: subitem.id },
      ).then(([file]) => saveSingleFile(key, file));
    }
    setPendingSingleFileChange(null);
  };
  useEffect(() => {
    if (!canEdit) return;
    const today = new Date().toISOString().slice(0, 10);
    const nextRows = (subitem.timelineRows ?? []).map((row) => {
      const progress = (row.subProgress ?? "").trim().toLowerCase();
      const complete = ["done", "delivered", "shipped out"].includes(progress);
      return row.timelineEnd &&
        row.timelineEnd < today &&
        !complete &&
        progress !== "late"
        ? { ...row, subProgress: "Late" }
        : row;
    });
    const count = nextRows.filter(
      (row, index) => row !== subitem.timelineRows[index],
    ).length;
    if (count) {
      onUpdate({ timelineRows: nextRows });
      toast.warning("Timeline progress updated", {
        description: `${count} process${count === 1 ? "" : "es"} automatically marked Late because its end date has passed.`,
      });
    }
  }, [subitem.id]);
  return (
    <div className="fixed inset-0 z-[220] bg-slate-950/40 p-3 sm:p-6">
      <section className="flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center gap-4 border-b border-slate-200 px-6 py-4">
          <div
            onMouseEnter={() => setHoverName(true)}
            onMouseLeave={() => setHoverName(false)}
            onClick={lock}
            className="min-w-0 flex-1"
          >
            <input
              value={subitem.name}
              readOnly={!canEdit}
              onChange={(event) => onUpdate({ name: event.target.value })}
              className={`w-full rounded border px-2 py-1 text-2xl font-semibold outline-none transition ${hoverName && canEdit ? "border-sky-400 bg-white" : "border-transparent bg-transparent"}`}
            />
          </div>
          <span className="hidden text-sm text-slate-400 sm:block">
            {clientName}
          </span>
          <div className="flex -space-x-2">
            {people.map((profile) => (
              <span
                key={profile.id}
                title={profile.full_name || profile.email || "User"}
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white"
                style={{ background: gradientForId(profile.id) }}
              >
                {(profile.full_name || profile.email || "U")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
            ))}
          </div>
          <button
            onClick={() =>
              siblingIndex > 0 && onNavigate(siblings[siblingIndex - 1])
            }
            disabled={siblingIndex <= 0}
            className="rounded border p-2 disabled:opacity-30"
            title="Previous subitem"
          >
            <ChevronLeft size={17} />
          </button>
          <button
            onClick={() =>
              siblingIndex < siblings.length - 1 &&
              onNavigate(siblings[siblingIndex + 1])
            }
            disabled={siblingIndex >= siblings.length - 1}
            className="rounded border p-2 disabled:opacity-30"
            title="Next subitem"
          >
            <ChevronRight size={17} />
          </button>
          <SubitemActionsMenu
            subitemId={subitem.id}
            subitemName={subitem.name}
            targetGroups={moveTargetGroups}
            canEdit={canEdit}
            onDuplicate={onDuplicate}
            onMove={onMove}
            onDelete={onDelete}
          />
          <button
            onClick={onClose}
            className="rounded border p-2"
            title="Close"
          >
            <X size={17} />
          </button>
        </header>
        <nav className="flex gap-6 border-b border-slate-200 px-6">
          {(
            [
              ["overview", "Overview"],
              ["files", "Files (Images)"],
              ["activity", "Activity Log"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`border-b-2 py-3 text-sm ${tab === key ? "border-sky-500 text-sky-600" : "border-transparent text-slate-500"}`}
            >
              {label}
            </button>
          ))}
        </nav>
        {tab === "overview" && (
          <main className="min-h-0 flex-1 overflow-auto bg-slate-50 p-6">
            <div className="mx-auto max-w-7xl space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <SingleFileSlot
                  title="Artwork"
                  file={artwork}
                  canEdit={canEdit}
                  onAdd={(file) =>
                    replaceSingleFile("artworkFile", artwork, file)
                  }
                  onRemove={() => requestSingleFileRemoval("artworkFile")}
                />
                <SingleFileSlot
                  title="OCF (Final Artwork)"
                  file={ocfFinalArtwork}
                  canEdit={canEdit}
                  onAdd={(file) =>
                    replaceSingleFile(
                      "ocfFinalArtworkFile",
                      ocfFinalArtwork,
                      file,
                    )
                  }
                  onRemove={() => requestSingleFileRemoval("ocfFinalArtworkFile")}
                />
              </div>
              <Section title="Subitem details">
                <div className="grid grid-cols-1 gap-x-5 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-500">
                      People
                    </label>
                    <div className="min-h-10" onClickCapture={lock}>
                      <AssigneeMultiSelect
                        profiles={profiles}
                        selectedIds={assigneeIds}
                        onChange={onAssigneesChange}
                      />
                    </div>
                  </div>
                  {badge("Status", "status", options.status)}
                  {badge(
                    "Local / Overseas",
                    "localOverseas",
                    options.localOverseas,
                  )}
                  {badge("Shipper", "shipper", options.shipper)}
                  {badge("Currency", "currency", options.currency)}
                  {text("Quantity", "qty")}
                  {text("Description", "description")}
                  {text("Remarks", "remarks")}
                  {text("Supplier", "supplier")}
                  {text("Cost", "cost")}
                  {text("C-SGD", "cSgd")}
                  {text("TC-SGD", "tcSgd")}
                  {text("Manpower", "manpower")}
                  {text("LS", "ls")}
                  {text("OS", "os")}
                  {text("Total cost", "tc")}
                  {text("Unit cost", "uc")}
                  {text("Production lead time", "pl")}
                  {text("Shipping lead time", "sl")}
                  {text("Price", "price")}
                  {text("Unit price", "up")}
                  {text("CN Tracking #", "cnTracking")}
                  {text("SG Tracking #", "sgTracking")}
                </div>
              </Section>
              <Section title="Payments">
                <div className="grid grid-cols-1 gap-x-5 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
                  {badge("Payment", "payment", options.payment)}
                  {badge(
                    "Payment status",
                    "paymentStatus",
                    options.paymentStatus,
                  )}
                  {badge(
                    "Mode of payment",
                    "modeOfPayment",
                    options.modeOfPayment,
                  )}
                  {text("Owner", "owner")}
                  {text("Total UC", "totalUc")}
                  {text("Total cost", "totalC")}
                  {text("Order #", "orderNumber")}
                  {text("Quantity ordered", "quantityProduced")}
                  {text("Quantity for client", "qtyFor")}
                  {text("Payment amount", "paymentAmount")}
                  {text("Difference", "difference")}
                  {text("Payment remarks", "paymentRemarks")}
                </div>
              </Section>
              <Section title="Timeline">
                <div className="space-y-3">
                  {(subitem.timelineRows ?? []).map((row, rowIndex) => (
                    <div
                      key={row.id || rowIndex}
                      className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-4"
                    >
                      {(
                        [
                          ["Name", "name"],
                          ["Person", "person"],
                          ["Remarks", "remarks"],
                          ["Cartons", "numOfCartons"],
                          ["Start date", "timelineStart"],
                          ["End date", "timelineEnd"],
                          ["Duration", "duration"],
                          ["Dependency", "dependency"],
                        ] as Array<[string, keyof TimelineRow]>
                      ).map(([label, key]) => (
                        <label
                          key={key}
                          className="text-xs font-medium text-slate-500"
                        >
                          {label}
                          <div
                            onClickCapture={lock}
                            className="mt-1 min-h-9 rounded border border-slate-200"
                          >
                            {key === "timelineStart" ||
                            key === "timelineEnd" ? (
                              canEdit ? (
                                <input
                                  type="date"
                                  value={dateValue(String(row[key] ?? ""))}
                                  onChange={(event) =>
                                    updateTimeline(
                                      rowIndex,
                                      key,
                                      event.target.value,
                                    )
                                  }
                                  className="h-[34px] w-full bg-transparent px-2 text-sm outline-none"
                                />
                              ) : (
                                <span className="flex min-h-[34px] items-center px-2 text-sm text-slate-700">
                                  {dateValue(String(row[key] ?? ""))
                                    .split("-")
                                    .reverse()
                                    .join("/")}
                                </span>
                              )
                            ) : (
                              <EditableCell
                                readOnly={!canEdit}
                                value={String(row[key] ?? "")}
                                onChange={(value) =>
                                  updateTimeline(rowIndex, key, value)
                                }
                                className="min-h-[34px] px-2 text-sm"
                              />
                            )}
                          </div>
                        </label>
                      ))}
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">
                          Sub-progress
                        </label>
                        <div
                          onClickCapture={lock}
                          className={`h-[34px] overflow-hidden rounded ${!canEdit ? "pointer-events-none opacity-70" : ""}`}
                        >
                          <StatusBadge
                            value={row.subProgress || "Pending"}
                            onChange={(value) =>
                              updateTimeline(rowIndex, "subProgress", value)
                            }
                            options={options.subProgress}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {!(subitem.timelineRows ?? []).length && (
                    <p className="text-sm text-slate-400">No timeline rows.</p>
                  )}
                </div>
              </Section>
              <Section title="Samples">
                <div className="grid grid-cols-1 gap-x-5 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
                  {text("Sample order status", "sampleOrderStatus")}
                  {text("Sample status", "sampleStatus")}
                  {text("Sample type", "sampleType")}
                </div>
                <div className="mt-4 space-y-3">
                  {(subitem.sampleRows ?? []).map((row, rowIndex) => (
                    <div
                      key={rowIndex}
                      className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-5"
                    >
                      {(
                        [
                          ["Status", "status"],
                          ["Type", "type"],
                          ["Return by", "returnByDate"],
                          ["Returned", "returnedDate"],
                          ["Sent", "sentDate"],
                        ] as Array<[string, keyof SampleRow]>
                      ).map(([label, key]) => (
                        <label
                          key={key}
                          className="text-xs font-medium text-slate-500"
                        >
                          {label}
                          <div
                            onClickCapture={lock}
                            className="mt-1 min-h-9 rounded border border-slate-200"
                          >
                            <EditableCell
                              readOnly={!canEdit}
                              value={row[key] ?? ""}
                              onChange={(value) =>
                                updateSample(rowIndex, key, value)
                              }
                              className="min-h-[34px] px-2 text-sm"
                            />
                          </div>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          </main>
        )}
        {tab === "files" && (
          <main className="min-h-0 flex-1 overflow-auto bg-slate-50 p-6">
            <div className="mx-auto max-w-4xl space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <SingleFileSlot
                  title="Artwork"
                  file={artwork}
                  canEdit={canEdit}
                  onAdd={(file) =>
                    replaceSingleFile("artworkFile", artwork, file)
                  }
                  onRemove={() => requestSingleFileRemoval("artworkFile")}
                />
                <SingleFileSlot
                  title="OCF (Final Artwork)"
                  file={ocfFinalArtwork}
                  canEdit={canEdit}
                  onAdd={(file) =>
                    replaceSingleFile(
                      "ocfFinalArtworkFile",
                      ocfFinalArtwork,
                      file,
                    )
                  }
                  onRemove={() => requestSingleFileRemoval("ocfFinalArtworkFile")}
                />
              </div>
              <FileDropTarget
                disabled={!canEdit}
                onFiles={(dropped) => {
                  void uploadCrmFiles(
                    dropped,
                    `subitems/${subitem.id}/files`,
                    { clientId, subitemId: subitem.id },
                  ).then((next) => saveFiles([...files, ...next]));
                }}
              >
                <section className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="font-semibold text-slate-800">
                      Other files / images
                    </h2>
                    {canEdit && (
                      <label className="cursor-pointer rounded border px-3 py-1.5 text-xs text-sky-700">
                        <Paperclip size={13} className="mr-1 inline" />
                        Add file
                        <input
                          type="file"
                          className="hidden"
                          onChange={(event) => {
                            void uploadCrmFiles(
                              Array.from(event.target.files ?? []),
                              `subitems/${subitem.id}/files`,
                              { clientId, subitemId: subitem.id },
                            ).then((next) => saveFiles([...files, ...next]));
                            event.target.value = "";
                          }}
                        />
                      </label>
                    )}
                  </div>
                  {files.length ? (
                    <div className="space-y-2">
                      {files.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center gap-2 rounded border p-2"
                        >
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0"
                            title={`Open ${file.name}`}
                          >
                            <FilePreview
                              url={file.url}
                              name={file.name}
                              mimeType={file.mimeType}
                              size="large"
                              className="h-20 w-28 sm:h-24 sm:w-36"
                            />
                          </a>
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noreferrer"
                            className="min-w-0 flex-1 truncate text-sm text-sky-700 hover:underline"
                          >
                            {file.name}
                          </a>
                          {canEdit && (
                            <button
                              onClick={() =>
                                saveFiles(
                                  files.filter((item) => item.id !== file.id),
                                )
                              }
                              className="text-xs text-red-500"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">No files attached.</p>
                  )}
                </section>
              </FileDropTarget>
            </div>
          </main>
        )}
        {tab === "activity" && (
          <main className="min-h-0 flex-1 overflow-auto bg-slate-50 p-6">
            <div className="mx-auto max-w-4xl space-y-3">
              {logs.map((entry) => (
                <article
                  key={entry.id}
                  className="rounded-lg border border-slate-100 bg-white px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-800">
                        <span className="font-medium">{entry.actorName}</span>{" "}
                        {entry.title ||
                          (entry.fieldName
                            ? `changed ${entry.fieldName} from ${formatValue(entry.oldValue)} to ${formatValue(entry.newValue)}`
                            : entry.action.replaceAll("_", " "))}
                        {entry.link && (
                          <a
                            href={entry.link}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-4 inline-flex rounded-md bg-teal-100 px-2 py-1 text-xs font-medium text-teal-600"
                          >
                            {entry.action === "estimate_created" ||
                            String(entry.meta?.fileName ?? "").startsWith(
                              "Sample Estimate",
                            )
                              ? "Open Estimate"
                              : "Open OCF"}
                          </a>
                        )}
                        {entry.description === "File has been removed" && (
                          <span
                            className="ml-4 inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500"
                            title="This file is no longer available"
                          >
                            File has been removed
                          </span>
                        )}
                        {entry.description === "File has been replaced" && (
                          <span
                            className="ml-4 inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500"
                            title="This file has been replaced"
                          >
                            File has been replaced
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(entry.createdAt).toLocaleString("en-GB")}
                      </p>
                    </div>
                    {entry.action === "subitem_field_changed" &&
                      entry.oldValue != null && (
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => void onUndo(entry)}
                          title={
                            !canEdit
                              ? "You can only edit items that are assigned to you"
                              : "Undo this action"
                          }
                          className="shrink-0 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Undo
                        </button>
                      )}
                  </div>
                </article>
              ))}
              {!logs.length && (
                <p className="text-center text-sm text-slate-400">
                  No activity recorded yet.
                </p>
              )}
            </div>
          </main>
        )}
      </section>
      {notice && (
        <button
          type="button"
          onClick={() => setNotice(null)}
          className="fixed z-[230] rounded bg-slate-800 px-3 py-2 text-xs text-white shadow-lg"
          style={notice}
        >
          You can only edit items that are assigned to you
        </button>
      )}
      <AlertDialog
        open={Boolean(pendingSingleFileChange)}
        onOpenChange={(open) => {
          if (!open) setPendingSingleFileChange(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingSingleFileChange?.type === "replace"
                ? `Replace ${pendingSingleFileChange.title}?`
                : `Remove ${pendingSingleFileChange?.title ?? "file"}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingSingleFileChange?.type === "replace"
                ? "The current file will be replaced by the selected file."
                : "This file will be removed from the subitem."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSingleFileChange}
              className={
                pendingSingleFileChange?.type === "remove"
                  ? "bg-red-600 hover:bg-red-700"
                  : undefined
              }
            >
              {pendingSingleFileChange?.type === "replace"
                ? "Replace file"
                : "Remove file"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="mb-5 text-lg font-semibold text-slate-800">{title}</h2>
      {children}
    </section>
  );
}

function SingleFileSlot({
  title,
  file,
  canEdit,
  onAdd,
  onRemove,
}: {
  title: string;
  file: Attachment | null;
  canEdit: boolean;
  onAdd: (file: File) => void;
  onRemove: () => void;
}) {
  const linkedNote =
    title === "Artwork"
      ? " Linked to estimate generation."
      : " Linked to OCF generation.";
  return (
    <FileDropTarget
      disabled={!canEdit}
      onFiles={(files) => {
        if (files[0]) onAdd(files[0]);
      }}
    >
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-1 font-semibold text-slate-800">{title}</h2>
        <p className="mb-4 text-xs text-slate-500">
          One file only. Adding another file replaces the current one.
          {linkedNote}
        </p>
        {file ? (
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
            <a
              href={file.url}
              target="_blank"
              rel="noreferrer"
              className="shrink-0"
              title={`Open ${file.name}`}
            >
              <FilePreview
                url={file.url}
                name={file.name}
                mimeType={file.mimeType}
                size="large"
              />
            </a>
            <a
              href={file.url}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 flex-1 truncate text-sm text-sky-700 hover:underline"
            >
              {file.name}
            </a>
            {canEdit && (
              <>
                <label className="cursor-pointer text-xs text-sky-700 hover:underline">
                  Replace
                  <input
                    type="file"
                    className="hidden"
                    onChange={(event) => {
                      const next = event.target.files?.[0];
                      if (next) onAdd(next);
                      event.target.value = "";
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={onRemove}
                  className="text-xs text-red-500"
                >
                  Remove
                </button>
              </>
            )}
          </div>
        ) : canEdit ? (
          <label className="flex min-h-24 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-slate-200 text-sm text-slate-500 hover:border-sky-300 hover:bg-sky-50">
            <Paperclip size={16} className="mr-2" />
            Drop or choose a file
            <input
              type="file"
              className="hidden"
              onChange={(event) => {
                const next = event.target.files?.[0];
                if (next) onAdd(next);
                event.target.value = "";
              }}
            />
          </label>
        ) : (
          <p className="py-6 text-center text-sm text-slate-400">
            No file uploaded.
          </p>
        )}
      </section>
    </FileDropTarget>
  );
}
