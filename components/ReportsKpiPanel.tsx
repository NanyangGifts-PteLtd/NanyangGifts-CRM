"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  Lock,
  Settings2,
  Target,
  Users,
} from "lucide-react";
import { toast } from "sonner";

type MonthOption = {
  groupId: string;
  year: number;
  month: number;
  start: string;
  end: string;
  label: string;
};
type Person = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url?: string | null;
  avatar_color?: string | null;
  isSuspended?: boolean;
};
type ReportSubitem = {
  id: string;
  displayId: string;
  name: string;
  status: string;
  markup: number;
  revenue: number;
};
type ReportClient = {
  id: string;
  displayId: string;
  name: string;
  channel: string;
  closedDate: string;
  invoices: string;
  verified: boolean;
  markup: number;
  revenue: number;
  subitems: ReportSubitem[];
};
type Salesperson = Person & { clients: ReportClient[] };
type Report = {
  range: { start: string; end: string };
  salespeople: Salesperson[];
  summary: { markup: number; closedLeads: number };
  progress: {
    year: number;
    monthlyTargets: Array<{ month: number; amount: number }>;
    yearlyTarget: number;
    currentProgress: number;
  };
};
type Metadata = {
  months: MonthOption[];
  salespeople: Person[];
  targets: Array<{
    target_year: number;
    target_month: number;
    target_amount: number | string;
  }>;
};

const REPORT_ROLES = new Set(["director", "admin", "dev"]);
const monthName = (month: number) =>
  new Intl.DateTimeFormat("en-SG", { month: "short" }).format(
    new Date(2026, month - 1, 1),
  );
const money = (value: number) =>
  new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    maximumFractionDigits: 2,
  }).format(value);
const dateLabel = (value: string) =>
  value
    ? new Intl.DateTimeFormat("en-SG", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "Asia/Singapore",
      }).format(new Date(`${value}T00:00:00+08:00`))
    : "—";
const personName = (person: Person) =>
  person.full_name?.trim() || person.email || "Unnamed Salesperson";

export function ReportsKpiPanel({
  currentUserRole,
}: {
  currentUserRole?: string | null;
}) {
  const allowed = REPORT_ROLES.has(String(currentUserRole ?? "").toLowerCase());
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [rangeMode, setRangeMode] = useState<"date" | "month">("month");
  const year = new Date().getFullYear();
  const [start, setStart] = useState(`${year}-01-01`);
  const [end, setEnd] = useState(`${year}-12-31`);
  const [startMonth, setStartMonth] = useState("");
  const [endMonth, setEndMonth] = useState("");
  const [salespersonIds, setSalespersonIds] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [progressYear, setProgressYear] = useState(year);
  const [editingTargets, setEditingTargets] = useState(false);
  const [targetDrafts, setTargetDrafts] = useState<Record<number, string>>({});

  const availableYears = useMemo(
    () =>
      Array.from(
        new Set([...(metadata?.months.map((item) => item.year) ?? []), year]),
      ).sort((a, b) => b - a),
    [metadata?.months, year],
  );
  const configuredRange = useMemo(() => {
    if (rangeMode === "date") return { start, end };
    const options = metadata?.months ?? [];
    const first = options.find(
      (item) => `${item.year}-${item.month}` === startMonth,
    );
    const last = options.find(
      (item) => `${item.year}-${item.month}` === endMonth,
    );
    return first && last ? { start: first.start, end: last.end } : null;
  }, [end, endMonth, metadata?.months, rangeMode, start, startMonth]);

  const loadMetadata = async (): Promise<Metadata | null> => {
    if (metadata) return metadata;
    if (loadingMetadata) return null;
    setLoadingMetadata(true);
    try {
      const response = await fetch("/api/reports/commission");
      const payload = (await response.json()) as Metadata & { error?: string };
      if (!response.ok)
        throw new Error(
          payload.error ?? "Could not load commission report settings.",
        );
      setMetadata(payload);
      return payload;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not load commission report settings.",
      );
      return null;
    } finally {
      setLoadingMetadata(false);
    }
  };

  const openCalculator = async () => {
    const loadedMetadata = await loadMetadata();
    const currentYearMonths = (loadedMetadata?.months ?? [])
      .filter((month) => month.year === year)
      .sort((left, right) => left.month - right.month);
    const january = currentYearMonths.find((month) => month.month === 1);
    const latest = currentYearMonths.at(-1);
    if (january && latest) {
      setStartMonth(`${january.year}-${january.month}`);
      setEndMonth(`${latest.year}-${latest.month}`);
      setRangeMode("month");
    }
    setShowSetup(true);
  };
  useEffect(() => {
    if (allowed && report) void loadMetadata();
  }, [allowed, report]);

  const runReport = async (requestedProgressYear = progressYear) => {
    if (!configuredRange)
      return toast.error("Choose both ends of the closed-month range.");
    setLoadingReport(true);
    try {
      const response = await fetch("/api/reports/commission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          range: configuredRange,
          ...(salespersonIds.length ? { salespersonIds } : {}),
          progressYear: requestedProgressYear,
        }),
      });
      const payload = (await response.json()) as Report & { error?: string };
      if (!response.ok)
        throw new Error(
          payload.error ?? "Could not run the commission report.",
        );
      setReport(payload);
      setShowSetup(false);
      setExpanded(new Set());
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not run the commission report.",
      );
    } finally {
      setLoadingReport(false);
    }
  };

  const saveTarget = async (month: number) => {
    const amount = Number(
      targetDrafts[month] ??
        report?.progress.monthlyTargets.find((target) => target.month === month)
          ?.amount ??
        0,
    );
    if (!Number.isFinite(amount) || amount < 0)
      return toast.error("Enter a valid non-negative target.");
    try {
      const response = await fetch("/api/reports/commission", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: progressYear, month, amount }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(payload.error ?? "Could not save the monthly target.");
      await loadMetadata();
      await runReport();
      toast.success(`${monthName(month)} target saved.`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not save the monthly target.",
      );
    }
  };

  const saveAllTargets = async () => {
    if (!report) return;
    const updates = report.progress.monthlyTargets.map((target) => ({
      year: progressYear,
      month: target.month,
      amount: Number(targetDrafts[target.month] ?? target.amount),
    }));
    if (updates.some((target) => !Number.isFinite(target.amount) || target.amount < 0)) {
      toast.error("Enter valid non-negative targets for every month.");
      return;
    }
    try {
      const responses = await Promise.all(
        updates.map((target) =>
          fetch("/api/reports/commission", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(target),
          }),
        ),
      );
      const failed = responses.find((response) => !response.ok);
      if (failed) {
        const payload = (await failed.json()) as { error?: string };
        throw new Error(payload.error ?? "Could not save the monthly targets.");
      }
      await runReport();
      setEditingTargets(false);
      toast.success("Monthly targets saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the monthly targets.");
    }
  };

  if (!report)
    return (
      <>
        <Landing
          allowed={allowed}
          loading={loadingMetadata}
          onOpen={openCalculator}
        />
        {showSetup && (
          <SetupDialog
            metadata={metadata}
            loading={loadingReport}
            rangeMode={rangeMode}
            setRangeMode={setRangeMode}
            start={start}
            setStart={setStart}
            end={end}
            setEnd={setEnd}
            startMonth={startMonth}
            setStartMonth={setStartMonth}
            endMonth={endMonth}
            setEndMonth={setEndMonth}
            selectedSalespeople={salespersonIds}
            setSelectedSalespeople={setSalespersonIds}
            onCancel={() => setShowSetup(false)}
            onRun={() => void runReport()}
          />
        )}
      </>
    );
  const progressPercent =
    report.progress.yearlyTarget > 0
      ? Math.max(
          0,
          (report.progress.currentProgress / report.progress.yearlyTarget) * 100,
        )
      : 0;
  const progressBarPercent = Math.min(progressPercent, 100);
  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-5 text-slate-800">
      <div className="mx-auto max-w-7xl space-y-5 pb-10">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Commission Calculator</h1>
            <p className="mt-1 text-sm text-slate-500">
              Closed-lead markup and Salesperson breakdown.
            </p>
          </div>
          <button
            onClick={() => setShowSetup(true)}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
          >
            <Settings2 size={16} /> Report settings
          </button>
        </header>
        <section className="grid gap-4 sm:grid-cols-2">
          <Metric
            label="Total Eligible Markup"
            value={money(report.summary.markup)}
          />
          <Metric
            label="Closed Leads"
            value={String(report.summary.closedLeads)}
            icon={<Users size={23} />}
          />
        </section>
        <section className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Cumulative Progress Tracker</h2>
              <p className="text-sm text-slate-500">
                Company-wide closed-lead markup, independent of the report
                filters.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={progressYear}
                onChange={(event) => {
                  const nextYear = Number(event.target.value);
                  setProgressYear(nextYear);
                  void runReport(nextYear);
                }}
                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
              >
                {availableYears.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  setTargetDrafts(
                    Object.fromEntries(
                      report.progress.monthlyTargets.map((target) => [
                        target.month,
                        String(target.amount),
                      ]),
                    ),
                  );
                  setEditingTargets(true);
                }}
                className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-medium hover:bg-slate-50"
              >
                <Target size={15} className="mr-1 inline" />
                Configure targets
              </button>
            </div>
          </div>
          <div className="mt-5">
            <div
              className="flex h-7 w-full overflow-hidden rounded-md border border-blue-200 bg-blue-50"
              aria-label="Monthly markup target segments"
            >
              {report.progress.monthlyTargets.map((target, index) => {
                const width = report.progress.yearlyTarget > 0
                  ? (target.amount / report.progress.yearlyTarget) * 100
                  : 100 / report.progress.monthlyTargets.length;
                return (
                  <div
                    key={target.month}
                    title={`${monthName(target.month)} target: ${money(target.amount)}`}
                    aria-label={`${monthName(target.month)} target: ${money(target.amount)}`}
                    className={`h-full min-w-[3px] cursor-help border-r border-white/80 transition-colors hover:bg-blue-700 ${index % 2 === 0 ? "bg-blue-600" : "bg-blue-500"}`}
                    style={{ width: `${width}%` }}
                  />
                );
              })}
            </div>
            <div className="mt-1 flex w-full text-[10px] font-semibold text-slate-500">
              {report.progress.monthlyTargets.map((target) => {
                const width = report.progress.yearlyTarget > 0
                  ? (target.amount / report.progress.yearlyTarget) * 100
                  : 100 / report.progress.monthlyTargets.length;
                return (
                  <span
                    key={target.month}
                    className="truncate text-center"
                    style={{ width: `${width}%`, minWidth: "3px" }}
                  >
                    {monthName(target.month)}
                  </span>
                );
              })}
            </div>
          </div>
          <div className="mt-5">
            <div className="flex justify-between text-sm">
              <span className="font-medium">
                Yearly target: {money(report.progress.yearlyTarget)}
              </span>
              <span className="font-semibold text-emerald-700">
                Current progress: {money(report.progress.currentProgress)} (
                {progressPercent.toFixed(1)}%)
              </span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-emerald-100">
              <div
                className="h-full rounded-full bg-emerald-600"
                style={{ width: `${progressBarPercent}%` }}
              />
            </div>
          </div>
        </section>
        <section className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-3 text-sm text-slate-600">
            Report range:{" "}
            <span className="font-semibold text-slate-900">
              {dateLabel(report.range.start)} – {dateLabel(report.range.end)}
            </span>
          </div>
          {report.salespeople.map((person) => (
            <SalespersonSection
              key={person.id}
              person={person}
              expanded={expanded}
              setExpanded={setExpanded}
            />
          ))}
          {!report.salespeople.length && (
            <p className="p-8 text-center text-sm text-slate-500">
              No selected Salespeople have matching closed leads.
            </p>
          )}
        </section>
      </div>
      {showSetup && (
        <SetupDialog
          metadata={metadata}
          loading={loadingReport}
          rangeMode={rangeMode}
          setRangeMode={setRangeMode}
          start={start}
          setStart={setStart}
          end={end}
          setEnd={setEnd}
          startMonth={startMonth}
          setStartMonth={setStartMonth}
          endMonth={endMonth}
          setEndMonth={setEndMonth}
          selectedSalespeople={salespersonIds}
          setSelectedSalespeople={setSalespersonIds}
          onCancel={() => setShowSetup(false)}
          onRun={() => void runReport()}
        />
      )}
      {editingTargets && (
        <TargetDialog
          year={progressYear}
          targets={report.progress.monthlyTargets}
          drafts={targetDrafts}
          setDrafts={setTargetDrafts}
          onSave={saveAllTargets}
          onClose={() => setEditingTargets(false)}
        />
      )}
    </div>
  );
}

function Landing({
  allowed,
  loading,
  onOpen,
}: {
  allowed: boolean;
  loading: boolean;
  onOpen: () => void;
}) {
  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-5">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold text-slate-900">Reports &amp; KPI</h1>
        <p className="mt-1 text-sm text-slate-500">
          Select a report to view its current data.
        </p>
        <button
          disabled={!allowed || loading}
          onClick={() => void onOpen()}
          className="mt-6 flex w-full max-w-md items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-sky-400 hover:shadow disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="rounded-lg bg-sky-100 p-3 text-sky-700">
            {allowed ? <BarChart3 size={26} /> : <Lock size={26} />}
          </span>
          <span>
            <span className="block text-lg font-bold">
              Commission Calculator
            </span>
            <span className="mt-1 block text-sm text-slate-500">
              Closed-lead markup, targets, and Salesperson breakdowns.
            </span>
            {!allowed && (
              <span className="mt-3 block text-xs font-medium text-slate-500">
                Available to directors, admins, and developers.
              </span>
            )}
          </span>
        </button>
      </div>
    </div>
  );
}
function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="border-t-4 border-sky-500 bg-white p-5 shadow-sm">
      <div className="flex justify-between gap-3">
        <div>
          <p className="text-3xl font-bold">{value}</p>
          <p className="mt-2 text-sm font-medium text-slate-600">{label}</p>
        </div>
        {icon}
      </div>
    </div>
  );
}
function SalespersonSection({
  person,
  expanded,
  setExpanded,
}: {
  person: Salesperson;
  expanded: Set<string>;
  setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="border-b border-slate-200 last:border-b-0">
      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        className="flex w-full items-center gap-2 bg-sky-50 px-5 py-3 text-left text-sm font-bold text-sky-950 hover:bg-sky-100"
        aria-expanded={!collapsed}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        <PersonAvatar person={person} />
        {personName(person)}{" "}
        <span className="ml-2 rounded-full bg-sky-600 px-2 py-0.5 text-xs text-white">
          {person.clients.length} Leads
        </span>
      </button>
      {!collapsed && <div className="overflow-x-auto">
        <table className="min-w-[1080px] w-full table-fixed text-sm">
          <colgroup>
            <col className="w-10" />
            <col className="w-[22%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[18%]" />
          </colgroup>
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="w-10 px-3 py-2" />
              <th className="px-3 py-2">Client Name</th>
              <th className="px-3 py-2">Channel</th>
              <th className="px-3 py-2">Verification</th>
              <th className="px-3 py-2">Closed Date</th>
              <th className="px-3 py-2 text-right">Markup</th>
              <th className="px-3 py-2 text-right">Revenue</th>
              <th className="px-3 py-2">Invoice #</th>
            </tr>
          </thead>
          <tbody>
            {person.clients.map((client) => (
              <ClientRows
                key={client.id}
                client={client}
                expanded={expanded.has(client.id)}
                onToggle={() =>
                  setExpanded((current) => {
                    const next = new Set(current);
                    next.has(client.id)
                      ? next.delete(client.id)
                      : next.add(client.id);
                    return next;
                  })
                }
              />
            ))}
          </tbody>
        </table>
      </div>}
    </div>
  );
}
function ClientRows({
  client,
  expanded,
  onToggle,
}: {
  client: ReportClient;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="border-t border-slate-100 hover:bg-slate-50">
        <td className="px-3 py-3">
          <button
            onClick={onToggle}
            className="rounded p-1 hover:bg-slate-200"
            aria-label="Show subitems"
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </td>
        <td className="px-3 py-3 font-medium">
          {client.name}{" "}
          <span className="ml-1 text-xs text-slate-400">
            {client.displayId}
          </span>
        </td>
        <td className="px-3 py-3">{client.channel || "—"}</td>
        <td className="px-3 py-3">
          {client.verified ? (
            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
              Verified
            </span>
          ) : (
            ""
          )}
        </td>
        <td className="px-3 py-3">{dateLabel(client.closedDate)}</td>
        <td className="px-3 py-3 text-right font-semibold text-sky-700">
          {money(client.markup)}
        </td>
        <td className="px-3 py-3 text-right font-semibold text-emerald-700">
          {money(client.revenue)}
        </td>
        <td className="px-3 py-3">{client.invoices || "—"}</td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50">
          <td colSpan={8} className="py-2.5 pl-16 pr-4">
            <table className="w-full table-fixed text-[11px] leading-4">
              <colgroup>
                <col className="w-[52%]" />
                <col className="w-[20%]" />
                <col className="w-[14%]" />
                <col className="w-[14%]" />
              </colgroup>
              <thead className="border-b border-slate-200 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-1.5 pr-2">Subitem</th>
                  <th className="pb-1.5 pr-2">Status</th>
                  <th className="pb-1.5 pr-2 text-right">Markup</th>
                  <th className="pb-1.5 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {client.subitems.map((subitem) => (
                  <tr
                    key={subitem.id}
                    className="border-b border-slate-200/80 last:border-b-0"
                  >
                    <td className="truncate py-1.5 pr-2 font-medium text-slate-700">
                      {subitem.name}{" "}
                      <span className="font-normal text-slate-400">
                        {subitem.displayId}
                      </span>
                    </td>
                    <td className="truncate pr-2 text-slate-600">
                      {subitem.status}
                    </td>
                    <td className="pr-2 text-right font-semibold text-sky-700">
                      {money(subitem.markup)}
                    </td>
                    <td className="text-right font-semibold text-emerald-700">
                      {money(subitem.revenue)}
                    </td>
                  </tr>
                ))}
                {!client.subitems.length && (
                  <tr>
                    <td colSpan={4} className="py-2.5 text-center text-slate-500">
                      No Awarded-or-later subitems.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}

function PersonAvatar({ person }: { person: Person }) {
  const initials = personName(person)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  if (person.avatar_url) {
    return (
      <img
        src={person.avatar_url}
        alt=""
        className="h-5 w-5 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
      style={{ backgroundColor: person.avatar_color || "#0284c7" }}
      aria-hidden="true"
    >
      {initials || "?"}
    </span>
  );
}

function TargetDialog({
  year,
  targets,
  drafts,
  setDrafts,
  onSave,
  onClose,
}: {
  year: number;
  targets: Array<{ month: number; amount: number }>;
  drafts: Record<number, string>;
  setDrafts: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  onSave: () => Promise<void>;
  onClose: () => void;
}) {
  const hasChanges = targets.some(
    (target) => Number(drafts[target.month] ?? target.amount) !== target.amount,
  );
  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-slate-900/35 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">Configure monthly targets</h2>
            <p className="mt-1 text-sm text-slate-500">
              Company-wide SGD markup targets for {year}.
            </p>
          </div>
          <button onClick={onClose} className="rounded px-2 py-1 text-sm hover:bg-slate-100">
            Close
          </button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {targets.map((target) => (
            <label key={target.month} className="text-sm font-medium text-slate-700">
              {monthName(target.month)}
              <div className="mt-1 flex gap-1">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={drafts[target.month] ?? String(target.amount)}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [target.month]: event.target.value,
                    }))
                  }
                  className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
            </label>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-2 text-sm hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!hasChanges}
            onClick={() => void onSave()}
            className="rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:hover:bg-slate-300"
          >
            Save targets
          </button>
        </div>
      </div>
    </div>
  );
}

function SetupDialog(props: {
  metadata: Metadata | null;
  loading: boolean;
  rangeMode: "date" | "month";
  setRangeMode: (value: "date" | "month") => void;
  start: string;
  setStart: (value: string) => void;
  end: string;
  setEnd: (value: string) => void;
  startMonth: string;
  setStartMonth: (value: string) => void;
  endMonth: string;
  setEndMonth: (value: string) => void;
  selectedSalespeople: string[];
  setSelectedSalespeople: React.Dispatch<React.SetStateAction<string[]>>;
  onCancel: () => void;
  onRun: () => void;
}) {
  const months = props.metadata?.months ?? [];
  const people = props.metadata?.salespeople ?? [];
  const toggle = (id: string) =>
    props.setSelectedSalespeople((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-slate-900/35 p-4">
      <div className="w-full max-w-xl rounded-xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-bold">Start Commission Calculator</h2>
        <p className="mt-1 text-sm text-slate-500">
          Choose the Closed Date range and Salespeople to display.
        </p>
        <div className="mt-5 flex gap-4 text-sm">
          <label>
            <input
              type="radio"
              checked={props.rangeMode === "month"}
              onChange={() => props.setRangeMode("month")}
            />{" "}
            Closed months
          </label>
          <label>
            <input
              type="radio"
              checked={props.rangeMode === "date"}
              onChange={() => props.setRangeMode("date")}
            />{" "}
            Exact date range
          </label>
        </div>
        {props.rangeMode === "date" ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <input
              type="date"
              value={props.start}
              onChange={(event) => props.setStart(event.target.value)}
              className="rounded border border-slate-300 p-2"
            />
            <input
              type="date"
              value={props.end}
              onChange={(event) => props.setEnd(event.target.value)}
              className="rounded border border-slate-300 p-2"
            />
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <select
              value={props.startMonth}
              onChange={(event) => props.setStartMonth(event.target.value)}
              className="rounded border border-slate-300 p-2"
            >
              <option value="">Starting closed month</option>
              {months.map((month) => (
                <option
                  key={`start-${month.groupId}`}
                  value={`${month.year}-${month.month}`}
                >
                  {month.label}
                </option>
              ))}
            </select>
            <select
              value={props.endMonth}
              onChange={(event) => props.setEndMonth(event.target.value)}
              className="rounded border border-slate-300 p-2"
            >
              <option value="">Ending closed month</option>
              {months.map((month) => (
                <option
                  key={`end-${month.groupId}`}
                  value={`${month.year}-${month.month}`}
                >
                  {month.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="mt-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Salespeople</p>
            <button
              onClick={() =>
                props.setSelectedSalespeople(people.map((person) => person.id))
              }
              className="text-xs text-sky-700"
            >
              All Salespeople
            </button>
          </div>
          <div className="mt-2 max-h-36 space-y-1 overflow-y-auto rounded border border-slate-200 p-2">
            {people.map((person) => (
              <label
                key={person.id}
                className="flex items-center gap-2 p-1 text-sm"
              >
                <input
                  type="checkbox"
                  checked={props.selectedSalespeople.includes(person.id)}
                  onChange={() => toggle(person.id)}
                />
                <PersonAvatar person={person} />
                <span>{personName(person)}</span>
                {person.isSuspended && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                    Suspended Account
                  </span>
                )}
              </label>
            ))}
            {!people.length && (
              <p className="text-sm text-slate-500">No Sales users found.</p>
            )}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={props.onCancel}
            className="rounded px-3 py-2 text-sm hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            disabled={props.loading}
            onClick={props.onRun}
            className="rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {props.loading ? "Running…" : "Run report"}
          </button>
        </div>
      </div>
    </div>
  );
}
