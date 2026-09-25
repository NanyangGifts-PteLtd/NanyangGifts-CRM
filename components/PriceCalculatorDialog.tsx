"use client";

import { useEffect, useState } from "react";
import { Check, LoaderCircle, SlidersHorizontal, X } from "lucide-react";
import { StatusBadge } from "@/components/ui/statusbadge";
import type { Subitem } from "@/app/types";
import type { OptionEntry } from "@/lib/board-labels";
import {
  calculateSubitemFinancials,
  parseSubitemNumber,
} from "@/lib/subitem-calculations";

type Record = {
  id: string;
  clientId: string;
  clientName: string;
  clientDisplayId: string;
  createdAt: string | null;
  qty: string;
  cost: string;
  currency: string;
  currencyOptionId: string | null;
  manpower: string;
  ls: string;
  os: string;
  up: string;
};
type Props = {
  subitem: Subitem;
  currencyOptions: OptionEntry[];
  readOnly?: boolean;
  onAddCurrency?: (name: string) => void | Promise<void>;
  onDeleteCurrency?: (name: string) => void | Promise<void>;
  onUpdateCurrencyOptionColor?: (
    name: string,
    color: string,
    id?: string,
  ) => void | Promise<void>;
  onRenameCurrencyOption?: (
    oldName: string,
    newName: string,
    id?: string,
  ) => void | Promise<void>;
  onReorderCurrencyOptions?: (
    layout: Array<{ id?: string; value: string; section: number }>,
  ) => void | Promise<void>;
  onUpdate: (changes: Partial<Subitem>) => void;
  onClose: () => void;
};
const TIERS = [750, 1000, 1250, 1500, 1750, 2000];
const fmt = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? "—" : n.toFixed(2);
const pct = (n: number | null) => (n == null ? "—" : `${n.toFixed(1)}%`);
const grid =
  "grid min-w-[980px] grid-cols-[minmax(190px,1.4fr)_100px_repeat(6,minmax(76px,1fr))_110px] gap-3";

function Header() {
  return (
    <div
      className={`${grid} border-b bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500`}
    >
      <span>Client / created</span>
      <span>Qty</span>
      <span>T.C</span>
      <span>U.C</span>
      <span>Price</span>
      <span>U.P</span>
      <span>Markup</span>
      <span>% Markup</span>
      <span />
    </div>
  );
}
function Metric({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange?: (value: number) => void;
}) {
  return (
    <div className="rounded border bg-slate-50 p-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      {onChange ? (
        <input
          type="number"
          step="any"
          value={value === "—" ? "" : value.replace("%", "")}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) onChange(next);
          }}
          className="mt-1 w-full bg-transparent text-lg font-semibold outline-none"
          aria-label={label}
        />
      ) : (
        <p className="mt-1 text-lg font-semibold">{value}</p>
      )}
    </div>
  );
}

export function PriceCalculatorDialog(props: Props) {
  const {
    subitem,
    currencyOptions,
    onUpdate,
    onClose,
    readOnly = false,
  } = props;
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [allHistory, setAllHistory] = useState(false);
  const [markup, setMarkup] = useState(1000);
  const financials = calculateSubitemFinancials(subitem, currencyOptions);
  const numberUpdate = (
    key: "qty" | "cost" | "manpower" | "ls" | "os",
    value: string,
  ) => onUpdate({ [key]: value } as Partial<Subitem>);
  const values = (amount: number) => {
    const price = financials.tc + amount;
    return {
      markup: amount,
      price,
      percent: financials.tc ? (amount / financials.tc) * 100 : null,
      up: financials.quantity ? price / financials.quantity : null,
    };
  };
  const setTypedMarkup = (candidate: number) => {
    if (!Number.isFinite(candidate) || candidate < 0 || candidate > 10000)
      return;
    setMarkup(candidate);
  };
  const useUp = (up: number | null) => {
    if (up != null) {
      onUpdate({ up: String(Number(up.toFixed(2))) });
      onClose();
    }
  };

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/price-calculator/history?name=${encodeURIComponent(subitem.name)}`,
        );
        const body = await response.json();
        if (alive) setRecords(response.ok ? (body.records ?? []) : []);
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [subitem.name]);

  const Input = ({
    label,
    field,
    value,
  }: {
    label: string;
    field: "qty" | "cost" | "manpower" | "ls" | "os";
    value: string;
  }) => (
    <label className="text-xs font-medium text-slate-600">
      {label}
      <input
        type="number"
        disabled={readOnly}
        value={value}
        onChange={(e) => numberUpdate(field, e.target.value)}
        className="mt-1 block h-9 w-full rounded border px-2 text-sm text-slate-900"
      />
    </label>
  );
  const Formula = ({ label, value }: { label: string; value: string }) => (
    <label className="text-xs font-medium text-slate-600">
      {label}
      <span className="mt-1 flex h-9 items-center rounded bg-slate-100 px-2 text-sm font-semibold text-slate-800">
        {value}
      </span>
    </label>
  );
  const Costs = () => (
    <section className="rounded-lg border bg-white p-4">
      <h3 className="mb-4 font-semibold">Costs</h3>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Qty" field="qty" value={subitem.qty} />
          <Input label="Cost" field="cost" value={subitem.cost} />
        </div>
        <div className="text-xs font-medium text-slate-600">
          Currency
          <div className="mt-1 h-9">
            <StatusBadge
              value={subitem.currency}
              readOnly={readOnly}
              onChange={(value, option) =>
                onUpdate({
                  currency: value,
                  currencyOptionId: option?.id ?? null,
                })
              }
              options={currencyOptions}
              onAddOption={props.onAddCurrency}
              onDeleteOption={props.onDeleteCurrency}
              manageLabel="currency"
              onUpdateOptionColor={props.onUpdateCurrencyOptionColor}
              onRenameOption={props.onRenameCurrencyOption}
              onReorderOptions={props.onReorderCurrencyOptions}
              small
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Formula label="C-SGD" value={fmt(financials.cSgd)} />
          <Formula label="TC-SGD" value={fmt(financials.tcSgd)} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Manpower" field="manpower" value={subitem.manpower} />
          <Input label="LS" field="ls" value={subitem.ls} />
          <Input label="OS" field="os" value={subitem.os} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Formula label="T.C" value={fmt(financials.tc)} />
          <Formula
            label="U.C"
            value={fmt(
              financials.quantity ? financials.tc / financials.quantity : null,
            )}
          />
        </div>
      </div>
    </section>
  );
  const Tiers = () => (
    <section className="rounded-lg border bg-white p-4">
      <h3 className="mb-4 font-semibold">Common Pricing Tiers</h3>
      <div className="overflow-x-auto rounded border">
        <div className="grid min-w-[560px] grid-cols-[repeat(4,1fr)_100px] gap-2 border-b bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
          <span>Markup</span>
          <span>% Markup</span>
          <span>U.P</span>
          <span>Price</span>
          <span />
        </div>
        {TIERS.map((tier) => {
          const row = values(tier);
          return (
            <div
              key={tier}
              className="grid min-w-[560px] grid-cols-[repeat(4,1fr)_100px] items-center gap-2 border-b px-3 py-2 text-sm"
            >
              <span>{fmt(row.markup)}</span>
              <span>{pct(row.percent)}</span>
              <span>{fmt(row.up)}</span>
              <span>{fmt(row.price)}</span>
              <button
                type="button"
                disabled={readOnly || row.up == null}
                onClick={() => useUp(row.up)}
                className="rounded bg-amber-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40"
              >
                Use U.P
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
  const Rows = ({ items }: { items: Record[] }) => (
    <>
      {items.map((record) => {
        const f = calculateSubitemFinancials(
          { ...subitem, ...record } as Subitem,
          currencyOptions,
        );
        return (
          <div
            key={record.id}
            className={`${grid} items-center border-b px-3 py-2.5 text-xs`}
          >
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent("crm:navigate-subitem", {
                    detail: { clientId: record.clientId, subitemId: record.id },
                  }),
                );
                onClose();
              }}
              className="text-left font-medium text-sky-700 hover:underline"
            >
              {record.clientName}
              {record.clientDisplayId ? ` · ${record.clientDisplayId}` : ""}
              <span className="block text-slate-400">
                {record.createdAt
                  ? new Date(record.createdAt).toLocaleDateString("en-SG")
                  : "—"}
              </span>
            </button>
            <span>{f.quantity || "—"}</span>
            <span>{fmt(f.tc)}</span>
            <span>{fmt(f.quantity ? f.tc / f.quantity : null)}</span>
            <span>{fmt(f.price)}</span>
            <span>{fmt(parseSubitemNumber(record.up))}</span>
            <span>{fmt(f.markup)}</span>
            <span>{pct(f.percentMarkup)}</span>
            <button
              type="button"
              disabled={readOnly}
              onClick={() => useUp(parseSubitemNumber(record.up))}
              className="inline-flex items-center justify-center gap-1 rounded bg-amber-600 px-2 py-1.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Check size={14} /> Use U.P
            </button>
          </div>
        );
      })}
    </>
  );
  const History = () => (
    <section className="rounded-lg border bg-white p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Historical Pricing / Transactions</h3>
          <p className="text-xs text-slate-500">
            Similar subitems Awarded before in Closed leads
          </p>
        </div>
        {records.length > 0 && (
          <button
            type="button"
            onClick={() => setAllHistory(true)}
            className="text-xs font-medium text-sky-700 hover:underline"
          >
            View full history ({records.length})
          </button>
        )}
      </div>
      <div className="max-h-[330px] overflow-auto rounded border">
        {loading ? (
          <p className="p-6 text-center text-sm text-slate-500">
            <LoaderCircle className="mr-1 inline animate-spin" size={15} />{" "}
            Loading history...
          </p>
        ) : records.length ? (
          <>
            <Header />
            <Rows items={records.slice(0, 5)} />
          </>
        ) : (
          <p className="p-6 text-center text-sm text-slate-400">
            No eligible historical records.
          </p>
        )}
      </div>
    </section>
  );
  const slider = values(markup);
  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-950/45 p-4">
      <section className="max-h-[calc(100vh-2rem)] w-full max-w-[1600px] overflow-y-auto rounded-xl bg-slate-50 p-6 shadow-2xl">
        <header className="mb-5 flex items-center justify-between border-b pb-4">
          <div>
            <h2 className="text-xl font-semibold">Price Calculator</h2>
            <p className="text-sm text-slate-500">
              {subitem.name || "Unnamed subitem"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-2 hover:bg-slate-200"
          >
            <X size={20} />
          </button>
        </header>
        <div className="grid gap-5 xl:grid-cols-2">
          <Costs />
          <Tiers />
        </div>
        <div className="mt-5">
          <History />
        </div>
        <section className="mt-5 rounded-lg border bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <SlidersHorizontal size={18} className="text-amber-600" />
            <h3 className="font-semibold">Price Slider</h3>
          </div>
          <input
            type="range"
            min="0"
            max="10000"
            step="1"
            value={markup}
            disabled={readOnly}
            onChange={(e) =>
              setMarkup(Math.round(Number(e.target.value) / 50) * 50)
            }
            className="h-2 w-full cursor-pointer accent-amber-600"
          />
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Metric
              label="Markup"
              value={fmt(slider.markup)}
              onChange={readOnly ? undefined : setTypedMarkup}
            />
            <Metric
              label="% Markup"
              value={pct(slider.percent)}
              onChange={
                readOnly
                  ? undefined
                  : (value) =>
                      setTypedMarkup(
                        financials.tc ? (value / 100) * financials.tc : 0,
                      )
              }
            />
            <Metric
              label="Price"
              value={fmt(slider.price)}
              onChange={
                readOnly
                  ? undefined
                  : (value) => setTypedMarkup(value - financials.tc)
              }
            />
            <Metric
              label="U.P"
              value={fmt(slider.up)}
              onChange={
                readOnly
                  ? undefined
                  : (value) =>
                      setTypedMarkup(
                        value * financials.quantity - financials.tc,
                      )
              }
            />
          </div>
          <button
            type="button"
            disabled={readOnly || slider.up == null}
            onClick={() => useUp(slider.up)}
            className="mt-5 rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Use slider U.P
          </button>
        </section>
        {allHistory && (
          <div className="fixed inset-0 z-[260] flex items-center justify-center bg-slate-950/45 p-4">
            <section className="max-h-[calc(100vh-3rem)] w-full max-w-[1500px] overflow-auto rounded-xl bg-white p-5 shadow-2xl">
              <header className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  All Historical Pricing
                </h3>
                <button
                  type="button"
                  onClick={() => setAllHistory(false)}
                  className="rounded p-2 hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </header>
              <div className="overflow-x-auto rounded border">
                <Header />
                <Rows items={records} />
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
