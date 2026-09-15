"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, RefreshCw, Send, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

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
};

type Props = { currentUserRole?: string | null };

const reviewerRoles = new Set(["admin", "director", "dev"]);

export function EmailReviewPanel({ currentUserRole }: Props) {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [canReview, setCanReview] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
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
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
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
                  <div className="flex gap-2">
                    <button
                      disabled={workingId === row.id}
                      onClick={() => void act(row.id, "mark-reviewed")}
                      className="inline-flex items-center gap-1 rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <Check size={15} /> Keep non-enquiry
                    </button>
                    <button
                      disabled={workingId === row.id}
                      onClick={() => void act(row.id, "promote")}
                      className="inline-flex items-center gap-1 rounded bg-[#16a5c4] px-3 py-2 text-sm font-semibold text-white hover:bg-[#118ca7] disabled:opacity-50"
                    >
                      <Send size={15} />{" "}
                      {workingId === row.id
                        ? "Promoting…"
                        : "Promote to enquiry"}
                    </button>
                  </div>
                ) : null}
              </div>
              <p className="mt-3 whitespace-pre-wrap rounded bg-slate-50 p-3 text-sm text-slate-700">
                {row.body_text || "(No email body)"}
              </p>
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
