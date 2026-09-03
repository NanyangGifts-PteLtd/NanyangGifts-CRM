"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { X } from "lucide-react";
import { Client, Subitem } from "@/app/types";
import { FileDropTarget } from "./ui/file-drop-target";

type AwardedSubitem = Pick<
  Subitem,
  | "id"
  | "name"
  | "qty"
  | "description"
  | "status"
  | "pl"
  | "sl"
  | "customFields"
  | "timelineRows"
>;
type FinalArtwork = { name: string; url: string; mimeType?: string };

type UploadRow = {
  subitemId: string;
  subitemName: string;
  qty: string | number;
  remarks: string;
  file: File | null;
  uploadedPath: string | null;
  isUploading: boolean;
  error: string | null;
  finalArtwork: FinalArtwork | null;
  usingFinalArtwork: boolean;
  loadingSavedArtwork: boolean;
  savedArtworkAttempted: boolean;
  needByDate: string;
  needByAsap: boolean;
};

type GenerateOcfModalProps = {
  open: boolean;
  client: Client | null;
  onClose: () => void;
  onCreated?: (result: {
    ocfId: string;
    internalUrl: string;
    clientUrl: string;
  }) => void;
  onSaveFinalArtwork?: (subitemId: string, file: File) => void | Promise<void>;
};
function toLeadTimeNumber(value: string | number | null | undefined) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function buildEstimatedDeliveryNotes(
  subitems: Array<{
    name?: string | null;
    pl?: string | number | null;
    sl?: string | number | null;
  }>,
) {
  return subitems
    .map((item) => {
      const pl = toLeadTimeNumber(item.pl);
      const sl = toLeadTimeNumber(item.sl);

      const lines: string[] = [];

      if (pl !== null) {
        lines.push(`- Estimated Production Lead Time: ${pl + 3} days `);
      }

      if (sl !== null) {
        lines.push(`- Estimated Shipping Lead Time: ${sl + 3} days `);
      }

      if (lines.length === 0) return null;

      return `${item.name || "Item"}\n${lines.join("\n")}`;
    })
    .filter(Boolean)
    .join("\n\n");
}
function savedFinalArtwork(raw?: string): FinalArtwork | null {
  try {
    const item = JSON.parse(raw ?? "null");
    return item?.url ? item : null;
  } catch {
    return null;
  }
}
function dateInputValue(value?: string | null) {
  if (!value) return "";
  const matched = value.match(/^\d{4}-\d{2}-\d{2}/);
  if (matched) return matched[0];
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}
function nbdTimelineRow(subitem: Pick<Subitem, "timelineRows">) {
  return (subitem.timelineRows ?? []).find(
    (row) => row.name.trim().toLowerCase() === "nbd",
  );
}
export function GenerateOcfModal({
  open,
  client,
  onClose,
  onCreated,
  onSaveFinalArtwork,
}: GenerateOcfModalProps) {
  const [awardedSubitems, setAwardedSubitems] = useState<AwardedSubitem[]>([]);
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [includedSubitemIds, setIncludedSubitemIds] = useState<string[]>([]);
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState("");
  const [estimatedDeliveryNotes, setEstimatedDeliveryNotes] = useState("");
  const [loadingItems, setLoadingItems] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const clientId = client?.id ?? null;

  useEffect(() => {
    if (!open || !client) return;

    const awarded = (client.subitems ?? []).filter(
      (s) => (s.status ?? "").toLowerCase() === "awarded",
    );

    const mappedAwarded = awarded.map((s) => ({
      id: s.id,
      name: s.name,
      qty: s.qty,
      description: s.description,
      status: s.status,
      pl: s.pl,
      sl: s.sl,
      customFields: s.customFields,
      timelineRows: s.timelineRows,
    }));

    setAwardedSubitems(mappedAwarded);

    setRows(
      awarded.map((s) => ({
        subitemId: s.id,
        subitemName: s.name ?? "",
        qty: s.qty ?? "",
        remarks: s.description ?? "",
        file: null,
        uploadedPath: null,
        isUploading: false,
        error: null,
        finalArtwork: savedFinalArtwork(s.customFields?.ocfFinalArtworkFile),
        usingFinalArtwork: Boolean(
          savedFinalArtwork(s.customFields?.ocfFinalArtworkFile),
        ),
        loadingSavedArtwork: false,
        savedArtworkAttempted: false,
        needByDate: dateInputValue(nbdTimelineRow(s)?.timelineStart),
        needByAsap:
          !dateInputValue(nbdTimelineRow(s)?.timelineStart) &&
          nbdTimelineRow(s)?.remarks.trim().toLowerCase() === "asap",
      })),
    );
    setIncludedSubitemIds(awarded.map((item) => item.id));

    setEstimatedDeliveryDate("");
    setEstimatedDeliveryNotes(buildEstimatedDeliveryNotes(mappedAwarded));
    setFormError(null);
    setCreating(false);
    setLoadingItems(false);
  }, [open, client]);

  const hasAwarded = awardedSubitems.length > 0;

  const selectedRows = useMemo(
    () => rows.filter((row) => includedSubitemIds.includes(row.subitemId)),
    [includedSubitemIds, rows],
  );
  const selectedAwardedSubitems = useMemo(
    () =>
      awardedSubitems.filter((item) => includedSubitemIds.includes(item.id)),
    [awardedSubitems, includedSubitemIds],
  );
  const hasIncludedItems = selectedRows.length > 0;
  const allFilesChosen = useMemo(
    () =>
      hasIncludedItems &&
      selectedRows.every((r) => !!r.file || !!r.uploadedPath),
    [hasIncludedItems, selectedRows],
  );
  const allNeedByDatesSet = useMemo(
    () =>
      hasIncludedItems &&
      selectedRows.every((row) => row.needByAsap || !!row.needByDate),
    [hasIncludedItems, selectedRows],
  );

  function toggleIncludedSubitem(subitemId: string, checked: boolean) {
    setIncludedSubitemIds((previous) =>
      checked
        ? [...new Set([...previous, subitemId])]
        : previous.filter((id) => id !== subitemId),
    );
  }

  useEffect(() => {
    if (!open) return;
    setEstimatedDeliveryNotes(
      buildEstimatedDeliveryNotes(selectedAwardedSubitems),
    );
  }, [open, selectedAwardedSubitems]);

  function updateRow(subitemId: string, patch: Partial<UploadRow>) {
    setRows((prev) =>
      prev.map((row) =>
        row.subitemId === subitemId ? { ...row, ...patch } : row,
      ),
    );
  }

  function selectImage(subitemId: string, file: File | undefined) {
    if (!file) return;
    const row = rows.find((item) => item.subitemId === subitemId);
    if (
      row?.finalArtwork &&
      !window.confirm(
        "This image will overwrite the current OCF (Final Artwork) after the OCF is generated. Continue?",
      )
    )
      return;
    updateRow(subitemId, {
      file,
      uploadedPath: null,
      error: null,
      usingFinalArtwork: false,
      loadingSavedArtwork: false,
    });
  }

  async function loadSavedFinalArtwork(subitemId: string) {
    const row = rows.find((item) => item.subitemId === subitemId);
    if (!row?.finalArtwork) return;
    updateRow(subitemId, {
      usingFinalArtwork: true,
      loadingSavedArtwork: true,
      savedArtworkAttempted: true,
      error: null,
    });
    try {
      const response = await fetch(row.finalArtwork.url);
      const blob = await response.blob();
      updateRow(subitemId, {
        usingFinalArtwork: true,
        file: new File([blob], row.finalArtwork.name, {
          type: blob.type || row.finalArtwork.mimeType || "image/png",
        }),
        uploadedPath: null,
        loadingSavedArtwork: false,
        error: null,
      });
    } catch {
      updateRow(subitemId, {
        usingFinalArtwork: false,
        loadingSavedArtwork: false,
        error: "Unable to load the saved final artwork.",
      });
    }
  }

  function useSavedFinalArtwork(subitemId: string, enabled: boolean) {
    if (!enabled) {
      updateRow(subitemId, {
        usingFinalArtwork: false,
        file: null,
        uploadedPath: null,
        loadingSavedArtwork: false,
        error: null,
      });
      return;
    }
    void loadSavedFinalArtwork(subitemId);
  }

  useEffect(() => {
    if (!open) return;
    rows
      .filter(
        (row) =>
          row.finalArtwork &&
          row.usingFinalArtwork &&
          !row.file &&
          !row.loadingSavedArtwork &&
          !row.savedArtworkAttempted,
      )
      .forEach((row) => {
        void loadSavedFinalArtwork(row.subitemId);
      });
  }, [open, rows]);

  async function handleUploadRow(subitemId: string) {
    const row = rows.find((r) => r.subitemId === subitemId);
    if (!row || !row.file || !clientId) return;

    updateRow(subitemId, { isUploading: true, error: null });

    try {
      const fd = new FormData();
      fd.append("file", row.file);
      fd.append("clientId", clientId);
      fd.append("subitemId", subitemId);

      const res = await fetch("/api/order-confirmations/upload-item-image", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      await Promise.all(
        selectedRows
          .filter((row) => row.file && !row.usingFinalArtwork)
          .map((row) => onSaveFinalArtwork?.(row.subitemId, row.file!)),
      );

      updateRow(subitemId, {
        uploadedPath: data.path,
        isUploading: false,
      });
    } catch (err: any) {
      updateRow(subitemId, {
        isUploading: false,
        error: err?.message || "Upload failed",
      });
    }
  }

  async function handleUploadAll() {
    for (const row of selectedRows) {
      if (row.file && !row.uploadedPath) {
        await handleUploadRow(row.subitemId);
      }
    }
  }

  async function handleCreate() {
    if (!clientId) return;

    setFormError(null);

    if (!hasAwarded) {
      setFormError("This client has no awarded subitems.");
      return;
    }

    if (!hasIncludedItems) {
      setFormError(
        "Select at least one awarded subitem to include in the OCF.",
      );
      return;
    }

    if (!allFilesChosen) {
      setFormError("Please choose an image for every included subitem.");
      return;
    }

    if (!allNeedByDatesSet) {
      setFormError(
        "Set a Need by Date (NBD), or select ASAP, for every included subitem.",
      );
      return;
    }

    const notUploaded = selectedRows.filter((r) => !r.uploadedPath);
    if (notUploaded.length > 0) {
      setFormError(
        "Please upload all selected files before generating the OCF.",
      );
      return;
    }

    setCreating(true);

    try {
      const payload = {
        clientId,
        estimatedDeliveryDate: estimatedDeliveryDate || null,
        estimatedDeliveryNotes: estimatedDeliveryNotes || "",
        itemUploads: selectedRows.map((row) => ({
          subitemId: row.subitemId,
          imagePath: row.uploadedPath,
          needBy: row.needByAsap ? "ASAP" : row.needByDate,
        })),
      };

      const res = await fetch("/api/order-confirmations/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate OCF");
      }

      onCreated?.({
        ocfId: data.ocfId,
        internalUrl: data.internalUrl,
        clientUrl: data.clientUrl,
      });

      onClose();
    } catch (err: any) {
      setFormError(err?.message || "Failed to generate OCF");
    } finally {
      setCreating(false);
    }
  }

  if (!open || !client) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-3xl rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Generate Order Confirmation Form
            </h2>
            <p className="text-xs text-gray-500">
              {client.name} {client.company ? `• ${client.company}` : ""}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-5 py-4">
          {!hasAwarded ? (
            <div className="rounded-lg border border-dashed border-gray-200 p-6 text-sm text-gray-500">
              No awarded subitems found for this client.
            </div>
          ) : (
            <>
              <div className="mb-5 grid grid-cols-1 gap-1 md:grid-cols-1">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Estimated delivery date:
                  </label>
                  <textarea
                    value={estimatedDeliveryNotes}
                    onChange={(e) => setEstimatedDeliveryNotes(e.target.value)}
                    rows={7}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#7BCBD5]"
                    placeholder="E.g. Production lead time: 2 days"
                  />
                </div>
              </div>

              <div className="space-y-3">
                {rows.map((row) => {
                  const isIncluded = includedSubitemIds.includes(row.subitemId);
                  return (
                    <div
                      key={row.subitemId}
                      className={`rounded-lg border p-4 ${isIncluded ? "border-gray-200 bg-gray-50" : "border-gray-200 bg-white opacity-70"}`}
                    >
                      <div className="mb-2 flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-start gap-3">
                          <label className="flex shrink-0 cursor-pointer flex-col items-center gap-1 text-center text-[10px] font-medium text-gray-600">
                            <input
                              type="checkbox"
                              checked={isIncluded}
                              onChange={(event) =>
                                toggleIncludedSubitem(
                                  row.subitemId,
                                  event.target.checked,
                                )
                              }
                              className="h-4 w-4 accent-[#7BCBD5]"
                            />
                            <span>
                              Include in
                              <br />
                              OCF?
                            </span>
                          </label>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {row.subitemName}
                            </p>
                            <p className="text-xs text-gray-500">
                              Qty: {row.qty || "-"}
                            </p>
                            <p className="mt-1 text-xs text-gray-600">
                              Remarks: {row.remarks || "-"}
                            </p>
                            {isIncluded && (
                              <div className="mt-3 flex flex-wrap items-end gap-3 rounded border border-amber-200 bg-amber-50 p-2.5">
                                <label className="text-xs font-medium text-amber-900">
                                  Need by date (NBD) *
                                  <input
                                    type="date"
                                    value={row.needByDate}
                                    disabled={row.needByAsap}
                                    onChange={(event) =>
                                      updateRow(row.subitemId, {
                                        needByDate: event.target.value,
                                        needByAsap: false,
                                      })
                                    }
                                    className="mt-1 block rounded border border-amber-300 bg-white px-2 py-1.5 text-sm text-slate-800 disabled:cursor-not-allowed disabled:bg-slate-100"
                                  />
                                </label>
                                <label className="flex cursor-pointer items-center gap-2 pb-1.5 text-xs font-medium text-amber-900">
                                  <input
                                    type="checkbox"
                                    checked={row.needByAsap}
                                    onChange={(event) =>
                                      updateRow(row.subitemId, {
                                        needByAsap: event.target.checked,
                                        needByDate: event.target.checked
                                          ? ""
                                          : row.needByDate,
                                      })
                                    }
                                    className="h-4 w-4 accent-[#7BCBD5]"
                                  />
                                  ASAP
                                </label>
                                <p className="pb-1.5 text-xs text-amber-800">
                                  Synced to the first NBD timeline date.
                                </p>
                              </div>
                            )}
                            {row.finalArtwork && (
                              <div className="mt-2 flex items-center gap-3 rounded border border-sky-100 bg-sky-50 p-2">
                                <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-sky-700">
                                  <input
                                    type="checkbox"
                                    checked={row.usingFinalArtwork}
                                    onChange={(event) =>
                                      useSavedFinalArtwork(
                                        row.subitemId,
                                        event.target.checked,
                                      )
                                    }
                                    className="h-4 w-4 accent-[#7BCBD5]"
                                  />
                                  {row.loadingSavedArtwork
                                    ? "Loading saved final artwork..."
                                    : "Use saved OCF (Final Artwork)"}
                                </label>
                                {(row.finalArtwork.mimeType?.startsWith(
                                  "image/",
                                ) ||
                                  row.finalArtwork.url.startsWith(
                                    "data:image/",
                                  )) && (
                                  <a
                                    href={row.finalArtwork.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="Open saved final artwork"
                                  >
                                    <img
                                      src={row.finalArtwork.url}
                                      alt={`Saved final artwork for ${row.subitemName}`}
                                      className="h-12 w-12 rounded border border-sky-200 object-cover"
                                    />
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {isIncluded && (
                        <FileDropTarget
                          onFiles={(files) =>
                            selectImage(
                              row.subitemId,
                              files.find((file) =>
                                file.type.startsWith("image/"),
                              ),
                            )
                          }
                          className="rounded-md"
                        >
                          <div className="flex flex-col gap-2 md:flex-row md:items-center">
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              onChange={(e) =>
                                selectImage(row.subitemId, e.target.files?.[0])
                              }
                              className="block text-sm file:mr-4 file:rounded-md file:border-0 file:bg-[#7BCBD5] file:px-3 file:py-2 file:font-medium file:text-white hover:file:bg-[#6cbac4]"
                            />

                            <button
                              type="button"
                              onClick={() => handleUploadRow(row.subitemId)}
                              disabled={!row.file || row.isUploading}
                              className="rounded-md bg-[#0D1821] px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {row.isUploading
                                ? "Uploading..."
                                : "Upload image"}
                            </button>

                            {row.uploadedPath && (
                              <span className="text-xs font-medium text-teal-600">
                                Uploaded
                              </span>
                            )}
                          </div>
                        </FileDropTarget>
                      )}

                      {row.error && (
                        <p className="mt-2 text-xs text-red-600">{row.error}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {formError && (
            <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {formError}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 px-5 py-4">
          <button
            type="button"
            onClick={handleUploadAll}
            disabled={!hasIncludedItems}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 disabled:opacity-50"
          >
            Upload all selected
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleCreate}
              disabled={!hasIncludedItems || creating}
              className="rounded-md bg-[#7BCBD5] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {creating ? "Generating..." : "Generate OCF"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
