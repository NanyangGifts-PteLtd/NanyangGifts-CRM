"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, GripVertical, PaintBucket, Pencil, Plus, Trash2 } from "lucide-react";

const MENU_WIDTH = 540;
const SECTION_WIDTH = 190;
const LABEL_COLORS = [
  "#b91c1c",
  "#dc2626",
  "#ef4444",
  "#f43f5e",
  "#be123c",
  "#ec4899",
  "#db2777",
  "#c026d3",
  "#a855f7",
  "#9333ea",
  "#7c3aed",
  "#6366f1",
  "#4f46e5",
  "#2563eb",
  "#3b82f6",
  "#0ea5e9",
  "#0891b2",
  "#06b6d4",
  "#0d9488",
  "#14b8a6",
  "#059669",
  "#16a34a",
  "#22c55e",
  "#65a30d",
  "#84cc16",
  "#ca8a04",
  "#eab308",
  "#f59e0b",
  "#ea580c",
  "#f97316",
  "#78716c",
  "#64748b",
  "#475569",
  "#334155",
  "#94a3b8",
  "#d1d5db",
];

export type BadgeOption = { value: string; color?: string; section?: number };
export type BadgeOptionLayout = { value: string; section: number };

function normalizeOptions(options: (string | BadgeOption)[]): BadgeOption[] {
  return options.map((option) =>
    typeof option === "string" ? { value: option } : option,
  );
}

export function StatusBadge({
  value,
  onChange,
  options: rawOptions,
  small = false,
  onAddOption,
  onDeleteOption,
  canDeleteOption,
  onUpdateOptionColor,
  onRenameOption,
  onReorderOptions,
  manageLabel = "option",
  readOnly = false,
  includeBlankOption = true,
  sectionCount = 1,
}: {
  value: string;
  onChange: (value: string) => void;
  options: (string | BadgeOption)[];
  small?: boolean;
  onAddOption?: (name: string) => void | Promise<void>;
  onDeleteOption?: (name: string) => void | Promise<void>;
  canDeleteOption?: (name: string) => boolean;
  onUpdateOptionColor?: (name: string, color: string) => void | Promise<void>;
  onRenameOption?: (oldName: string, newName: string) => void | Promise<void>;
  onReorderOptions?: (layout: BadgeOptionLayout[]) => void | Promise<void>;
  manageLabel?: string;
  readOnly?: boolean;
  includeBlankOption?: boolean;
  sectionCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const [editingLabels, setEditingLabels] = useState(false);
  const [newOption, setNewOption] = useState("");
  const [colorEditor, setColorEditor] = useState<string | null>(null);
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
  const [draggedOption, setDraggedOption] = useState<string | null>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const configuredOptions = normalizeOptions(rawOptions);
  // A synthetic blank option clears the label without adding a mutable option
  // to the shared label configuration.
  const options =
    !includeBlankOption ||
    configuredOptions.some((option) => option.value === "")
      ? configuredOptions
      : [{ value: "", color: "#bfc0c2", section: 0 }, ...configuredOptions];
  const normalizedSectionCount = Math.max(1, sectionCount);
  const sectionFor = (option: BadgeOption) =>
    Math.min(
      normalizedSectionCount - 1,
      Math.max(0, Number.isInteger(option.section) ? Number(option.section) : 0),
    );
  const optionsBySection = Array.from(
    { length: normalizedSectionCount },
    (_, section) => options.filter((option) => sectionFor(option) === section),
  );
  const largestSectionSize = Math.max(
    ...optionsBySection.map((section) => section.length),
  );
  const activeBg =
    options.find((option) => option.value === value)?.color ?? "#e5e7eb";

  const positionMenu = React.useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const desiredWidth = normalizedSectionCount > 1
      ? normalizedSectionCount * SECTION_WIDTH + 32
      : MENU_WIDTH;
    const width = Math.min(desiredWidth, window.innerWidth - 16);
    const left = Math.min(
      Math.max(8, rect.left + rect.width / 2 - width / 2),
      window.innerWidth - width - 8,
    );
    const estimatedHeight = Math.min(
      (largestSectionSize + 1) * 46 + 90,
      620,
    );
    const top =
      window.innerHeight - rect.bottom >= estimatedHeight
        ? rect.bottom + 6
        : rect.top - estimatedHeight - 6;
    setMenuStyle({ position: "fixed", top, left, width, zIndex: 9999 });
  }, [largestSectionSize, normalizedSectionCount]);

  const resetMenuState = () => {
    setEditingLabels(false);
    setColorEditor(null);
    setDraftNames({});
    setNewOption("");
    setDraggedOption(null);
  };

  const closeMenu = () => {
    setOpen(false);
    resetMenuState();
  };

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !btnRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
        setEditingLabels(false);
        setColorEditor(null);
        setDraftNames({});
        setNewOption("");
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const reposition = () => positionMenu();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, positionMenu]);

  const handleOpen = () => {
    if (readOnly) return;
    if (!btnRef.current) return;
    if (open) {
      closeMenu();
      return;
    }
    resetMenuState();
    positionMenu();
    setOpen(true);
  };

  const rename = async (oldName: string) => {
    const nextName = (draftNames[oldName] ?? oldName).trim();
    if (nextName && nextName !== oldName)
      await onRenameOption?.(oldName, nextName);
  };

  const moveOption = async (targetSection: number, targetName?: string) => {
    if (draggedOption === null || draggedOption === targetName) return;
    const grouped = Array.from({ length: normalizedSectionCount }, (_, section) =>
      configuredOptions
        .filter((option) => sectionFor(option) === section)
        .map((option) => option.value),
    );
    for (const values of grouped) {
      const index = values.indexOf(draggedOption);
      if (index >= 0) values.splice(index, 1);
    }
    const targetValues = grouped[targetSection];
    const targetIndex = targetName !== undefined
      ? targetValues.indexOf(targetName)
      : -1;
    if (targetIndex >= 0) targetValues.splice(targetIndex, 0, draggedOption);
    else targetValues.push(draggedOption);
    const layout = grouped.flatMap((values, section) =>
      values.map((optionValue) => ({ value: optionValue, section })),
    );
    setDraggedOption(null);
    await onReorderOptions?.(layout);
  };

  const renderOption = (option: BadgeOption, section: number) => {
    const optionColor = option.color ?? "#e5e7eb";
    const allowDelete = canDeleteOption ? canDeleteOption(option.value) : true;
    const isStoredOption = configuredOptions.some(
      (configuredOption) => configuredOption.value === option.value,
    );
    const canDrag = editingLabels && Boolean(onReorderOptions) && isStoredOption;
    return (
      <div
        key={option.value || "__empty__"}
        draggable={canDrag}
        onDragStart={(event) => {
          if (!canDrag) return;
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", option.value || "__blank_label__");
          setDraggedOption(option.value);
        }}
        onDragOver={(event) => {
          if (editingLabels && draggedOption !== null) event.preventDefault();
        }}
        onDrop={(event) => {
          if (!editingLabels) return;
          event.preventDefault();
          event.stopPropagation();
          void moveOption(section, option.value);
        }}
        onDragEnd={() => setDraggedOption(null)}
        className={`relative min-w-0 ${canDrag ? "cursor-grab active:cursor-grabbing" : ""} ${draggedOption === option.value ? "opacity-40" : ""}`}
      >
        {!editingLabels ? (
          <button type="button" onClick={() => { onChange(option.value); closeMenu(); }} aria-label={option.value || "Clear label"} title={option.value || "Clear label"} className="flex h-8 w-full items-center justify-center rounded-sm px-2 text-xs font-semibold text-white transition hover:brightness-95" style={{ background: optionColor }}>
            <span className="truncate">{option.value}</span>
            {option.value === value && <Check className="ml-1 shrink-0" size={13} />}
          </button>
        ) : option.value === "" ? (
          <div className="flex h-9 items-center gap-1 rounded-md border border-gray-200 bg-gray-50 p-1 text-xs text-gray-500">
            {canDrag && <span className="flex h-7 w-4 shrink-0 cursor-grab items-center justify-center text-[#0f8da8] active:cursor-grabbing" title="Drag to reorder or move section"><GripVertical size={15} /></span>}
            <button type="button" onClick={() => setColorEditor(colorEditor === option.value ? null : option.value)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-white" style={{ background: optionColor }} title="Change blank label color"><PaintBucket size={14} /></button>
            <span className="px-1">Blank label</span>
          </div>
        ) : (
          <div className="flex h-9 items-center gap-1 rounded-md border border-gray-200 bg-white p-1">
            {onReorderOptions && <span className="flex h-7 w-4 shrink-0 cursor-grab items-center justify-center text-[#0f8da8] active:cursor-grabbing" title="Drag to reorder or move section"><GripVertical size={15} /></span>}
            <button type="button" onClick={() => setColorEditor(colorEditor === option.value ? null : option.value)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-white" style={{ background: optionColor }} title={`Change ${manageLabel} color`}><PaintBucket size={14} /></button>
            <input value={draftNames[option.value] ?? option.value} onChange={(event) => setDraftNames((previous) => ({ ...previous, [option.value]: event.target.value }))} onBlur={() => void rename(option.value)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} className="min-w-0 flex-1 px-1 text-xs text-gray-700 outline-none" />
            {onDeleteOption && allowDelete && <button type="button" onClick={() => void onDeleteOption(option.value)} className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" title={`Delete ${manageLabel}`}><Trash2 size={13} /></button>}
          </div>
        )}
        {colorEditor === option.value && onUpdateOptionColor && (
          <div className="absolute left-0 top-10 z-20 grid w-56 grid-cols-6 gap-2 rounded-lg border border-gray-200 bg-white p-2 shadow-xl">
            {LABEL_COLORS.map((color) => <button key={color} type="button" onClick={async () => { await onUpdateOptionColor(option.value, color); setColorEditor(null); }} className="h-6 w-6 rounded-md border border-white ring-1 ring-gray-200 transition hover:scale-110" style={{ background: color }} title={color} />)}
          </div>
        )}
      </div>
    );
  };

  const menu =
    open &&
    createPortal(
      <div
        ref={menuRef}
        style={menuStyle}
        className="max-h-[min(620px,calc(100vh-16px))] overflow-auto rounded-xl border border-gray-200 bg-white p-4 shadow-2xl"
      >
        <div className={normalizedSectionCount > 1 ? "grid min-w-max gap-0" : "grid grid-cols-1 gap-2 sm:grid-cols-3"} style={normalizedSectionCount > 1 ? { gridTemplateColumns: `repeat(${normalizedSectionCount}, minmax(${SECTION_WIDTH - 24}px, 1fr))` } : undefined}>
          {optionsBySection.map((sectionOptions, section) => (
            <div key={section} onDragOver={(event) => { if (editingLabels && draggedOption !== null) event.preventDefault(); }} onDrop={(event) => { if (!editingLabels) return; event.preventDefault(); void moveOption(section); }} className={`${normalizedSectionCount > 1 ? `min-h-14 space-y-2 px-3 ${section > 0 ? "border-l border-gray-300" : ""}` : "contents"}`}>
              {sectionOptions.map((option) => renderOption(option, section))}
              {editingLabels && onAddOption && section === 0 && (
            <div className="flex h-9 items-center gap-1 rounded-md border border-dashed border-gray-300 p-1">
              <input
                value={newOption}
                onChange={(event) => setNewOption(event.target.value)}
                placeholder={`New ${manageLabel}`}
                className="min-w-0 flex-1 px-2 text-xs text-gray-700 outline-none"
              />
              <button
                type="button"
                onClick={async () => {
                  const name = newOption.trim();
                  if (!name) return;
                  await onAddOption(name);
                  setNewOption("");
                }}
                className="inline-flex h-7 items-center rounded bg-[#7BCBD5] px-2 text-[10px] font-semibold text-white"
              >
                <Plus size={11} /> Add
              </button>
            </div>
              )}
            </div>
          ))}
        </div>
        {(onAddOption || onUpdateOptionColor || onRenameOption) && (
          <button
            type="button"
            onClick={() => {
              setEditingLabels((previous) => !previous);
              setColorEditor(null);
            }}
            className="mt-4 flex w-full items-center justify-center gap-2 border-t border-gray-200 pt-3 text-sm text-gray-600 hover:text-gray-900"
          >
            <Pencil size={15} />
            {editingLabels ? "Done editing" : "Edit labels"}
          </button>
        )}
      </div>,
      document.body,
    );

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        aria-label={value || "Set label"}
        title={
          readOnly
            ? "Cost fields are locked because this subitem is paid"
            : undefined
        }
        className={`ck h-full w-full whitespace-nowrap font-medium leading-none transition duration-150 ${readOnly ? "cursor-not-allowed opacity-70" : "active:scale-95"} ${small ? "text-[12.6px]" : "text-[12.6px]"}`}
        style={{ background: activeBg, color: "#ffffff", minWidth: 50 }}
      >
        {value}
      </button>
      {menu}
    </>
  );
}
