"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronRight, Search } from "lucide-react";

export type ColumnSelectionOption = {
  key: string;
  label: string;
  category: string;
};

type TriggerState = { open: boolean; toggle: () => void };

type SharedProps = {
  options: ColumnSelectionOption[];
  disabled?: boolean;
  placeholder?: string;
  menuClassName?: string;
  renderTrigger?: (state: TriggerState) => ReactNode;
};

type SingleProps = SharedProps & {
  mode?: "single";
  value: string;
  onChange: (value: string) => void;
};

type MultipleProps = SharedProps & {
  mode: "multiple";
  selectedKeys: Set<string>;
  onToggle: (key: string, selected: boolean) => void;
  onSetAll?: (selected: boolean) => void;
};

/** Shared searchable, sectioned Board-column selector. */
export function ColumnSelectionPicker(props: SingleProps | MultipleProps) {
  const { options, disabled = false, placeholder = "Choose a column", menuClassName = "", renderTrigger } = props;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  const groupedOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = normalizedQuery
      ? options.filter((option) => option.label.toLowerCase().includes(normalizedQuery) || option.category.toLowerCase().includes(normalizedQuery))
      : options;
    return Array.from(filtered.reduce((groups, option) => {
      const entries = groups.get(option.category) ?? [];
      entries.push(option);
      groups.set(option.category, entries);
      return groups;
    }, new Map<string, ColumnSelectionOption[]>()));
  }, [options, query]);

  const selectedValue = props.mode === "multiple" ? "" : options.find((option) => option.key === props.value)?.label ?? "";
  const allSelected = props.mode === "multiple" && options.length > 0 && options.every((option) => props.selectedKeys.has(option.key));
  const toggle = () => { if (!disabled) setOpen((current) => !current); };

  return (
    <div ref={rootRef} className="relative min-w-0" data-crm-menu-trigger>
      {renderTrigger ? renderTrigger({ open, toggle }) : (
        <button type="button" disabled={disabled} onClick={toggle} className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 text-left text-sm text-slate-700 outline-none transition focus:border-sky-400 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400">
          <span className={selectedValue ? "truncate" : "truncate text-slate-400"}>{selectedValue || placeholder}</span>
          <ChevronDown size={15} className="shrink-0 text-slate-400" />
        </button>
      )}
      {open && !disabled && (
        <div data-crm-menu className={`absolute left-0 top-full z-menu mt-1 w-[min(920px,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-4 shadow-2xl ${menuClassName}`}>
          <div className="relative mb-2">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a column" className="h-8 w-full rounded border border-slate-300 pl-7 pr-2 text-sm outline-none focus:border-sky-400" />
          </div>
          {props.mode === "multiple" && props.onSetAll && (
            <label className="flex cursor-pointer items-center gap-2 border-b border-slate-100 py-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={allSelected} onChange={(event) => props.onSetAll?.(event.target.checked)} className="h-4 w-4 accent-[#0f8da8]" />
              Show all columns
            </label>
          )}
          <div className="max-h-[min(68vh,680px)] overflow-y-auto pt-1">
            {groupedOptions.map(([category, groupOptions]) => {
              const collapsed = collapsedGroups.has(category);
              const groupSelected = props.mode === "multiple" && groupOptions.every((option) => props.selectedKeys.has(option.key));
              return (
                <div key={category} className="min-w-0">
                  <div className="mt-1 flex items-center gap-2 border-t border-slate-100 py-2.5 text-sm font-semibold text-slate-600">
                    <button type="button" onClick={() => setCollapsedGroups((current) => { const next = new Set(current); if (next.has(category)) next.delete(category); else next.add(category); return next; })} className="flex min-w-0 flex-1 items-center gap-2 text-left hover:text-sky-700">
                      {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                      <span className="truncate">{category} columns</span>
                    </button>
                    {props.mode === "multiple" && (
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-500">
                        <input type="checkbox" checked={groupSelected} onChange={(event) => { for (const option of groupOptions) props.onToggle(option.key, event.target.checked); }} className="h-4 w-4 accent-[#0f8da8]" /> All
                      </label>
                    )}
                  </div>
                  {!collapsed && (
                    <div className="grid grid-cols-1 gap-x-2 2xl:grid-cols-2">
                      {groupOptions.map((option) => props.mode === "multiple" ? (
                        <label key={option.key} className="ml-4 flex cursor-pointer items-center gap-2 border-l border-slate-100 py-1.5 pl-3 text-sm text-slate-700 hover:bg-slate-50">
                          <input type="checkbox" checked={props.selectedKeys.has(option.key)} onChange={(event) => props.onToggle(option.key, event.target.checked)} className="h-4 w-4 accent-[#0f8da8]" />
                          <span className="truncate">{option.label}</span>
                        </label>
                      ) : (
                        <button key={option.key} type="button" onClick={() => { props.onChange(option.key); setOpen(false); }} className={`ml-4 flex min-w-0 items-center gap-2 border-l border-slate-100 py-1.5 pl-3 text-left text-sm hover:bg-slate-50 ${props.value === option.key ? "font-semibold text-sky-800" : "text-slate-700"}`}>
                          <span className="w-4 shrink-0 text-sky-600">{props.value === option.key ? <Check size={15} /> : null}</span>
                          <span className="truncate">{option.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {!groupedOptions.length && <p className="px-3 py-4 text-center text-sm text-slate-400">No matching columns</p>}
          </div>
        </div>
      )}
    </div>
  );
}
