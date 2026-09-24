"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, RefreshCw, Send, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
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

type ReviewRow = {
  id: string;
  external_id: string;
  sender_name: string;
  sender_email: string;
  subject: string;
  body_text: string;
  email_type: "ENQUIRY" | "NON-ENQUIRY";
  review_status: "pending" | "promoting" | "promoted" | "reviewed" | "failed";
  reviewed_at: string | null;
  promotion_error: string | null;
  created_at: string;
  attachments?: Array<{ id: string; name: string; url: string }>;
};

type Props = { currentUserRole?: string | null };

const reviewerRoles = new Set(["admin", "director", "dev"]);

export function EmailReviewPanel({ currentUserRole }: Props) {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [canReview, setCanReview] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [selectedReviewedId, setSelectedReviewedId] = useState<string | null>(
    null,
  );
  const [reviewedFilter, setReviewedFilter] = useState<
    "all" | "kept" | "promoted"
  >("all");
  const [pendingAction, setPendingAction] = useState<{
    row: ReviewRow;
    action: "promote" | "mark-reviewed";
  } | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/email-review");
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Could not load email review.");
      setRows(result.rows ?? []);
      setCanReview(result.canReview === true);
    } catch (error) {
      toast.error("Email review could not be loaded", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const act = async (id: string, action: "promote" | "mark-reviewed") => {
    setWorkingId(id);
    try {
      const response = await fetch("/api/email-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Could not update this email.");
      setRows((current) =>
        current.map((row) => (row.id === id ? result.row : row)),
      );
      toast.success(
        action === "promote"
          ? "Email promoted to enquiry"
          : "Email marked reviewed",
      );
    } catch (error) {
      toast.error("Email review action failed", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setWorkingId(null);
    }
  };
  const roleCanReview =
    reviewerRoles.has(String(currentUserRole ?? "").toLowerCase()) && canReview;
  const pendingRows = rows.filter(
    (row) => row.review_status === "pending" || row.review_status === "failed",
  );
  const reviewedRows = rows.filter(
    (row) =>
      row.review_status === "reviewed" || row.review_status === "promoted",
  );
  const filteredReviewedRows = reviewedRows.filter((row) =>
    reviewedFilter === "all"
      ? true
      : reviewedFilter === "promoted"
        ? row.review_status === "promoted"
        : row.review_status === "reviewed",
  );
  const selectedReviewed =
    filteredReviewedRows.find((row) => row.id === selectedReviewedId) ??
    filteredReviewedRows[0] ??
    null;
  const reviewedOutcome = (row: ReviewRow) =>
    row.review_status === "promoted"
      ? "Promoted to enquiry"
      : "Kept non-enquiry";
  const emailMeta = (row: ReviewRow) => (
    <>
      <p className="mt-1 text-sm text-slate-600">
        {row.sender_name || "Unknown sender"}
        {row.sender_email ? ` · ${row.sender_email}` : ""}
      </p>
      <p className="mt-1 text-xs text-slate-400">
        {new Date(row.created_at).toLocaleString("en-SG")} · Message ID:{" "}
        {row.external_id}
      </p>
    </>
  );
  const attachments = (row: ReviewRow) =>
    row.attachments?.length ? (
      <div className="mt-3 flex flex-wrap gap-2">
        {row.attachments.map((attachment) => (
          <a
            key={attachment.id}
            href={attachment.url}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-sky-200 bg-sky-50 px-2 py-1 text-sm text-sky-700 hover:bg-sky-100"
          >
            {attachment.name}
          </a>
        ))}
      </div>
    ) : null;
  return (
    <section className="crm-board min-h-full bg-slate-50 p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Email Review</h1>
          <p className="mt-1 text-sm text-slate-500">
            Emails classified as non-enquiries are held here before they can
            enter the CRM.
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw size={15} /> Refresh
        </button>
      </div>
      {!roleCanReview && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <ShieldAlert size={16} /> Read-only: only admin, director, and dev can
          review or promote emails.
        </div>
      )}
      {pendingAction && (
        <AlertDialog
          open
          onOpenChange={(open) => !open && setPendingAction(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {pendingAction.action === "promote"
                  ? "Promote this email to an enquiry?"
                  : "Keep this email as a non-enquiry?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {pendingAction.action === "promote"
                  ? "This will create or update the related CRM enquiry."
                  : "This email will be marked as reviewed and remain outside the enquiry queue."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  const action = pendingAction.action;
                  const id = pendingAction.row.id;
                  setPendingAction(null);
                  void act(id, action);
                }}
              >
                Confirm{" "}
                {pendingAction.action === "promote" ? "promotion" : "keep"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {loading ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <p className="px-4 py-10 text-center text-sm text-slate-400">
            Loading email review…
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-xl font-semibold text-slate-800">
                Pending review
              </h2>
              <p className="text-sm text-slate-500">
                {pendingRows.length} email{pendingRows.length === 1 ? "" : "s"}{" "}
                waiting for a decision
              </p>
            </div>
            {!pendingRows.length ? (
              <p className="px-4 py-10 text-center text-sm text-slate-400">
                No emails are pending review.
              </p>
            ) : (
              pendingRows.map((row) => {
                const actionable =
                  row.review_status === "pending" ||
                  row.review_status === "failed";
                return (
                  <article
                    key={row.id}
                    className="border-b border-slate-200 p-4 last:border-b-0"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-800">
                            {row.subject || "(No subject)"}
                          </h3>
                          <span className="rounded bg-slate-700 px-2 py-0.5 text-xs font-semibold text-white">
                            {row.email_type}
                          </span>
                          {row.review_status === "failed" && (
                            <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">
                              failed
                            </span>
                          )}
                        </div>
                        {emailMeta(row)}
                      </div>
                      {roleCanReview && actionable && (
                        <div className="flex flex-wrap gap-4">
                          <button
                            disabled={workingId === row.id}
                            onClick={() =>
                              setPendingAction({ row, action: "mark-reviewed" })
                            }
                            className="order-2 inline-flex items-center gap-1 rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            <Check size={15} /> Keep non-enquiry
                          </button>
                          <button
                            disabled={workingId === row.id}
                            onClick={() =>
                              setPendingAction({ row, action: "promote" })
                            }
                            className="order-3 ml-8 inline-flex items-center gap-1 rounded bg-[#16a5c4] px-3 py-2 text-sm font-semibold text-white hover:bg-[#118ca7] disabled:opacity-50"
                          >
                            <Send size={15} /> Promote to New Lead
                          </button>
                          <button
                            type="button"
                            disabled={workingId === row.id}
                            onClick={() =>
                              toast.info("Blacklist sender is not available yet.")
                            }
                            className="order-1 inline-flex items-center gap-1 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                          >
                            <ShieldAlert size={15} /> Blacklist sender
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="mt-3 max-h-[32rem] overflow-y-auto whitespace-pre-wrap rounded bg-slate-50 p-3 text-sm text-slate-700">
                      {row.body_text || "(No email body)"}
                    </p>
                    {attachments(row)}
                    {row.promotion_error && (
                      <p className="mt-2 text-sm text-red-600">
                        Promotion error: {row.promotion_error}
                      </p>
                    )}
                  </article>
                );
              })
            )}
          </section>
          <aside className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-xl font-semibold text-slate-800">Reviewed</h2>
                  <p className="text-sm text-slate-500">
                    {filteredReviewedRows.length}{reviewedFilter !== "all" ? ` of ${reviewedRows.length}` : ""} kept or promoted emails
                  </p>
                </div>
                <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
                  {([
                    ["all", "All"],
                    ["kept", "Kept non-enquiry"],
                    ["promoted", "Promoted"],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setReviewedFilter(value)}
                      className={`rounded px-2 py-1.5 font-medium transition-colors ${reviewedFilter === value ? "bg-white text-sky-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto border-b border-slate-200">
              {!filteredReviewedRows.length ? (
                <p className="px-4 py-8 text-center text-sm text-slate-400">
                  No {reviewedFilter === "all" ? "reviewed emails" : reviewedFilter === "promoted" ? "promoted emails" : "kept non-enquiry emails"} yet.
                </p>
              ) : (
                filteredReviewedRows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setSelectedReviewedId(row.id)}
                    className={`block w-full border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50 ${selectedReviewed?.id === row.id ? "bg-sky-50" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-slate-800">
                        {row.subject || "(No subject)"}
                      </span>
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${row.review_status === "promoted" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                      >
                        {reviewedOutcome(row)}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {row.sender_name || row.sender_email || "Unknown sender"}{" "}
                      · {(row.body_text || "").slice(0, 90)}
                    </p>
                  </button>
                ))
              )}
            </div>
            {selectedReviewed && (
              <article className="p-4">
                <h3 className="font-semibold text-slate-800">
                  {selectedReviewed.subject || "(No subject)"}
                </h3>
                {emailMeta(selectedReviewed)}
                <p className="mt-3 max-h-[32rem] overflow-y-auto whitespace-pre-wrap rounded bg-slate-50 p-3 text-sm text-slate-700">
                  {selectedReviewed.body_text || "(No email body)"}
                </p>
                {attachments(selectedReviewed)}
              </article>
            )}
          </aside>
        </div>
      )}
      {/* Legacy list retained below only during the transition. */}
      <div className="hidden">
        {loading ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">
            Loading email review…
          </p>
        ) : null}
        {!loading && !rows.length ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">
            No classified non-enquiry emails are waiting for review.
          </p>
        ) : null}
        {rows.map((row) => {
          const actionable =
            row.review_status === "pending" || row.review_status === "failed";
          return (
            <article
              key={row.id}
              className="border-b border-slate-200 p-4 last:border-b-0"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-slate-800">
                      {row.subject || "(No subject)"}
                    </h2>
                    <span className="rounded bg-slate-700 px-2 py-0.5 text-xs font-semibold text-white">
                      {row.email_type}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {row.review_status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {row.sender_name || "Unknown sender"}
                    {row.sender_email ? ` · ${row.sender_email}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {new Date(row.created_at).toLocaleString("en-SG")} · Message
                    ID: {row.external_id}
                  </p>
                </div>
                {roleCanReview && actionable ? (
                  <div className="flex flex-wrap gap-4">
                    <button
                      disabled={workingId === row.id}
                      onClick={() => void act(row.id, "mark-reviewed")}
                      className="order-2 inline-flex items-center gap-1 rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <Check size={15} /> Keep non-enquiry
                    </button>
                    <button
                      disabled={workingId === row.id}
                      onClick={() => void act(row.id, "promote")}
                      className="order-3 ml-8 inline-flex items-center gap-1 rounded bg-[#16a5c4] px-3 py-2 text-sm font-semibold text-white hover:bg-[#118ca7] disabled:opacity-50"
                    >
                      <Send size={15} />{" "}
                      {workingId === row.id
                        ? "Promoting…"
                        : "Promote to New Lead"}
                    </button>
                    <button
                      type="button"
                      disabled={workingId === row.id}
                      onClick={() =>
                        toast.info("Blacklist sender is not available yet.")
                      }
                      className="order-1 inline-flex items-center gap-1 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      <ShieldAlert size={15} /> Blacklist sender
                    </button>
                  </div>
                ) : null}
              </div>
              <p className="mt-3 whitespace-pre-wrap rounded bg-slate-50 p-3 text-sm text-slate-700">
                {row.body_text || "(No email body)"}
              </p>
              {row.attachments?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {row.attachments.map((attachment) => (
                    <a
                      key={attachment.id}
                      href={attachment.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded border border-sky-200 bg-sky-50 px-2 py-1 text-sm text-sky-700 hover:bg-sky-100"
                    >
                      {attachment.name}
                    </a>
                  ))}
                </div>
              ) : null}
              {row.promotion_error ? (
                <p className="mt-2 text-sm text-red-600">
                  Promotion error: {row.promotion_error}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
