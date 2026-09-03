"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, PaintBucket, Pencil, Plus, Trash2 } from "lucide-react";

const MENU_WIDTH = 540;
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

export type BadgeOption = { value: string; color?: string };

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
  manageLabel = "option",
  readOnly = false,
  includeBlankOption = true,
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
  manageLabel?: string;
  readOnly?: boolean;
  includeBlankOption?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editingLabels, setEditingLabels] = useState(false);
  const [newOption, setNewOption] = useState("");
  const [colorEditor, setColorEditor] = useState<string | null>(null);
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
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
      : [{ value: "", color: "#bfc0c2" }, ...configuredOptions];
  const activeBg =
    options.find((option) => option.value === value)?.color ?? "#e5e7eb";

  const resetMenuState = () => {
    setEditingLabels(false);
    setColorEditor(null);
    setDraftNames({});
    setNewOption("");
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

  const handleOpen = () => {
    if (readOnly) return;
    if (!btnRef.current) return;
    if (open) {
      closeMenu();
      return;
    }
    resetMenuState();
    const rect = btnRef.current.getBoundingClientRect();
    const width = Math.min(MENU_WIDTH, window.innerWidth - 16);
    const left = Math.min(
      Math.max(8, rect.left + rect.width / 2 - width / 2),
      window.innerWidth - width - 8,
    );
    const estimatedHeight = Math.min(
      Math.ceil((options.length + 1) / 3) * 46 + 76,
      520,
    );
    const top =
      window.innerHeight - rect.bottom >= estimatedHeight
        ? rect.bottom + 6
        : Math.max(8, rect.top - estimatedHeight - 6);
    setMenuStyle({ position: "fixed", top, left, width, zIndex: 9999 });
    setOpen(true);
  };

  const rename = async (oldName: string) => {
    const nextName = (draftNames[oldName] ?? oldName).trim();
    if (nextName && nextName !== oldName)
      await onRenameOption?.(oldName, nextName);
  };

  const menu =
    open &&
    createPortal(
      <div
        ref={menuRef}
        style={menuStyle}
        className="max-h-[min(520px,calc(100vh-16px))] overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 shadow-2xl"
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {options.map((option) => {
            const optionColor = option.color ?? "#e5e7eb";
            const allowDelete = canDeleteOption
              ? canDeleteOption(option.value)
              : true;
            return (
              <div
                key={option.value || "__empty__"}
                className="relative min-w-0"
              >
                {!editingLabels ? (
                  <button
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      closeMenu();
                    }}
                    aria-label={option.value || "Clear label"}
                    title={option.value || "Clear label"}
                    className="flex h-8 w-full items-center justify-center rounded-sm px-2 text-xs font-semibold text-white transition hover:brightness-95"
                    style={{ background: optionColor }}
                  >
                    <span className="truncate">{option.value}</span>
                    {option.value === value && (
                      <Check className="ml-1 shrink-0" size={13} />
                    )}
                  </button>
                ) : option.value === "" ? (
                  <div className="flex h-9 items-center rounded-md border border-gray-200 bg-gray-50 px-3 text-xs text-gray-500">
                    Blank label
                  </div>
                ) : (
                  <div className="flex h-9 items-center gap-1 rounded-md border border-gray-200 bg-white p-1">
                    <button
                      type="button"
                      onClick={() =>
                        setColorEditor(
                          colorEditor === option.value ? null : option.value,
                        )
                      }
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-white"
                      style={{ background: optionColor }}
                      title={`Change ${manageLabel} color`}
                    >
                      <PaintBucket size={14} />
                    </button>
                    <input
                      value={draftNames[option.value] ?? option.value}
                      onChange={(event) =>
                        setDraftNames((previous) => ({
                          ...previous,
                          [option.value]: event.target.value,
                        }))
                      }
                      onBlur={() => void rename(option.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                      }}
                      className="min-w-0 flex-1 px-1 text-xs text-gray-700 outline-none"
                    />
                    {onDeleteOption && allowDelete && (
                      <button
                        type="button"
                        onClick={() => void onDeleteOption(option.value)}
                        className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        title={`Delete ${manageLabel}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                )}
                {colorEditor === option.value && onUpdateOptionColor && (
                  <div className="absolute left-0 top-10 z-20 grid w-56 grid-cols-6 gap-2 rounded-lg border border-gray-200 bg-white p-2 shadow-xl">
                    {LABEL_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={async () => {
                          await onUpdateOptionColor(option.value, color);
                          setColorEditor(null);
                        }}
                        className="h-6 w-6 rounded-md border border-white ring-1 ring-gray-200 transition hover:scale-110"
                        style={{ background: color }}
                        title={color}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {editingLabels && onAddOption && (
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
