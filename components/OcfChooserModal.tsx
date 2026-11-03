"use client";

import { useEffect, useMemo, useState } from "react";
import { FilePlus2, FileText, LoaderCircle, Pencil, X } from "lucide-react";
import type { Client } from "@/app/types";
import { useEscapeClose } from "./hooks/use-escape-close";

type OcfFile = {
  id: string;
  name: string;
  url: string;
  createdAt?: string;
  signed?: boolean;
};

export function OcfChooserModal({
  open,
  client,
  canGenerate,
  onClose,
  onGenerate,
  onEdit,
}: {
  open: boolean;
  client: Client | null;
  canGenerate: boolean;
  onClose: () => void;
  onGenerate: () => void;
  onEdit: (ocfId: string) => void;
}) {
  const [files, setFiles] = useState<OcfFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const fallbackFiles = useMemo<OcfFile[]>(() => {
    if (!client) return [];
    const signedIds = new Set(
      (client.activityLog ?? [])
        .filter((entry) => entry.action === "ocf_signed")
        .map((entry) => String(entry.meta?.ocfId ?? ""))
        .filter(Boolean),
    );
    return (client.activityLog ?? [])
      .filter((entry) => entry.action === "ocf_created" && entry.link)
      .map((entry) => ({
        id: entry.id,
        name: entry.title || "Order Confirmation Form",
        url: entry.link!,
        createdAt: entry.createdAt,
        signed: signedIds.has(String(entry.meta?.ocfId ?? "")),
      }));
  }, [client]);
  const ocfFiles = files.length ? files : fallbackFiles;

  useEscapeClose({ open: open && Boolean(client), onClose });
  useEffect(() => {
    if (!open || !client) return;
    let active = true;
    setFiles([]);
    setLoadingFiles(true);
    void fetch(`/api/order-confirmations?clientId=${encodeURIComponent(client.id)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load OCF files");
        return response.json() as Promise<OcfFile[]>;
      })
      .then((items) => {
        if (active) setFiles(items);
      })
      .catch(() => {
        // Activity-log entries remain a useful fallback for transient failures.
        if (active) setFiles([]);
      })
      .finally(() => {
        if (active) setLoadingFiles(false);
      });
    return () => {
      active = false;
    };
  }, [client, open]);
  if (!open || !client) return null;

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ocf-chooser-title"
    >
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2
              id="ocf-chooser-title"
              className="text-base font-semibold text-slate-900"
            >
              Order Confirmation Form
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {client.name || "Unnamed client"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5">
          <div className="flex justify-center">
            <span title={canGenerate ? undefined : "Generating OCF is for Sales"}>
            <button
              type="button"
              onClick={onGenerate}
              disabled={!canGenerate}
              className="flex min-h-28 w-64 flex-col items-center justify-center rounded-xl border-2 border-teal-200 bg-teal-50 p-4 text-center transition hover:border-teal-400 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-teal-200 disabled:hover:bg-teal-50"
            >
              <FilePlus2 size={22} className="mb-2 text-teal-600" />
              <strong className="text-sm text-teal-900">Generate OCF</strong>
              <span className="mt-1 text-xs leading-5 text-teal-800">
                Create a new Order Confirmation Form for this client.
              </span>
            </button>
            </span>
          </div>

          {(loadingFiles || ocfFiles.length > 0) && (
            <section className="mt-5 border-t border-slate-200 pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Existing OCFs</h3>
              {loadingFiles && !ocfFiles.length ? (
                <div className="flex items-center gap-2 py-4 text-sm text-slate-500"><LoaderCircle size={15} className="animate-spin" /> Loading OCFs…</div>
              ) : (
                <div className="mt-2 max-h-52 space-y-2 overflow-y-auto pr-1">
                  {ocfFiles.map((file) => (
                    <div key={file.id} className="flex min-w-0 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-2">
                      <FileText size={18} className="shrink-0 text-sky-600" />
                      <div className="min-w-0 flex-1">
                        <a href={file.url} target="_blank" rel="noreferrer" className="block truncate text-sm text-sky-700 hover:underline">{file.name}</a>
                        <p className="text-[11px] text-slate-400">{file.signed ? "Signed · " : ""}{file.createdAt ? new Date(file.createdAt).toLocaleString("en-GB") : ""}</p>
                      </div>
                      <button type="button" disabled={!canGenerate} title={canGenerate ? undefined : "PM users cannot edit OCFs"} onClick={() => onEdit(file.id)} className="inline-flex shrink-0 items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">
                        <Pencil size={12} /> Edit
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
