"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  GripVertical,
  PaintBucket,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

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

export type BadgeOption = {
  id?: string;
  systemKey?: string | null;
  value: string;
  color?: string;
  section?: number;
};
export type BadgeOptionLayout = {
  id?: string;
  value: string;
  section: number;
};

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
  readOnlyReason,
  includeBlankOption = true,
  sectionCount = 1,
}: {
  value: string;
  onChange: (value: string, option?: BadgeOption) => void;
  options: (string | BadgeOption)[];
  small?: boolean;
  onAddOption?: (name: string) => void | Promise<void>;
  onDeleteOption?: (name: string, optionId?: string) => void | Promise<void>;
  canDeleteOption?: (name: string) => boolean;
  onUpdateOptionColor?: (name: string, color: string, optionId?: string) => void | Promise<void>;
  onRenameOption?: (oldName: string, newName: string, optionId?: string) => void | Promise<void>;
  onReorderOptions?: (layout: BadgeOptionLayout[]) => void | Promise<void>;
  manageLabel?: string;
  readOnly?: boolean;
  readOnlyReason?: string;
  includeBlankOption?: boolean;
  sectionCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const [editingLabels, setEditingLabels] = useState(false);
  const [newOption, setNewOption] = useState("");
  const [colorEditor, setColorEditor] = useState<string | null>(null);
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
  const [draggedOption, setDraggedOption] = useState<string | null>(null);
  const [editorOptions, setEditorOptions] = useState<BadgeOption[] | null>(
    null,
  );
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<BadgeOption[]>([]);
  const localLayoutSnapshotRef = useRef<string | null>(null);
  const localLayoutTimerRef = useRef<number | null>(null);
  const [localLayoutVersion, setLocalLayoutVersion] = useState(0);
  const configuredOptions = normalizeOptions(rawOptions);
  // A synthetic blank option clears the label without adding a mutable option
  // to the shared label configuration.
  const baseOptions =
    !includeBlankOption ||
    configuredOptions.some((option) => option.value === "")
      ? configuredOptions
      : [{ value: "", color: "#bfc0c2", section: 0 }, ...configuredOptions];
  const optionSnapshot = (entries: BadgeOption[]) =>
    entries
      .map((entry) =>
        [entry.id ?? "", entry.value, entry.color ?? "", entry.section ?? 0].join(
          "\u001f",
        ),
      )
      .join("\u001e");
  const baseOptionsSnapshot = optionSnapshot(baseOptions);
  // While editing, preserve a local ordering draft. Parent props update after
  // each optimistic save, but two quick drops can otherwise calculate from a
  // render that predates the first drop and visibly bounce the second one.
  const options = editingLabels && editorOptions ? editorOptions : baseOptions;
  optionsRef.current = options;
  const normalizedSectionCount = Math.max(1, sectionCount);
  const optionKey = (option: BadgeOption) =>
    option.id ?? `value:${option.value}`;
  const sectionFor = (option: BadgeOption) =>
    Math.min(
      normalizedSectionCount - 1,
      Math.max(
        0,
        Number.isInteger(option.section) ? Number(option.section) : 0,
      ),
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
    const desiredWidth =
      normalizedSectionCount > 1
        ? normalizedSectionCount * SECTION_WIDTH + 32
        : MENU_WIDTH;
    const width = Math.min(desiredWidth, window.innerWidth - 16);
    const clampedLeft = Math.min(
      Math.max(8, rect.left + rect.width / 2 - width / 2),
      window.innerWidth - width - 8,
    );
    const fallbackHeight = Math.min(
      normalizedSectionCount > 1
        ? (largestSectionSize + 1) * 46 + 90
        : Math.ceil((options.length + 1) / 3) * 46 + 76,
      620,
    );
    const measuredHeight = menuRef.current?.getBoundingClientRect().height;
    const menuHeight =
      measuredHeight && measuredHeight > 0 ? measuredHeight : fallbackHeight;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const preferredTop =
      spaceBelow >= menuHeight || spaceBelow >= spaceAbove
        ? rect.bottom + 6
        : rect.top - menuHeight - 6;
    const anchorIsVisible =
      rect.bottom >= 0 &&
      rect.top <= window.innerHeight &&
      rect.right >= 0 &&
      rect.left <= window.innerWidth;
    const top = anchorIsVisible
      ? Math.min(
          Math.max(8, preferredTop),
          Math.max(8, window.innerHeight - menuHeight - 8),
        )
      : preferredTop;
    const left = anchorIsVisible
      ? clampedLeft
      : rect.left + rect.width / 2 - width / 2;
    setMenuStyle({ position: "fixed", top, left, width, zIndex: 9999 });
  }, [largestSectionSize, normalizedSectionCount, options.length]);

  const resetMenuState = () => {
    if (localLayoutTimerRef.current !== null) {
      window.clearTimeout(localLayoutTimerRef.current);
      localLayoutTimerRef.current = null;
    }
    localLayoutSnapshotRef.current = null;
    setEditingLabels(false);
    setColorEditor(null);
    setDraftNames({});
    setNewOption("");
    setDraggedOption(null);
    setEditorOptions(null);
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

  // A local reorder remains authoritative until its matching persisted
  // snapshot arrives. This lets external changes stay live without allowing
  // stale events from the current user's queued drag saves to rubberband the
  // menu back to an older order.
  useEffect(() => {
    if (!editingLabels) return;
    const editorSnapshot = editorOptions ? optionSnapshot(editorOptions) : "";
    if (editorSnapshot === baseOptionsSnapshot) return;
    if (localLayoutSnapshotRef.current !== null) return;
    setEditorOptions(baseOptions);
    setDraftNames({});
    setColorEditor(null);
  }, [baseOptionsSnapshot, editorOptions, editingLabels, localLayoutVersion]);

  useEffect(
    () => () => {
      if (localLayoutTimerRef.current !== null)
        window.clearTimeout(localLayoutTimerRef.current);
    },
    [],
  );

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

  React.useLayoutEffect(() => {
    if (!open) return;
    positionMenu();
  }, [colorEditor, editingLabels, open, positionMenu]);

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

  const rename = async (oldName: string, optionId?: string) => {
    const nextName = (draftNames[oldName] ?? oldName).trim();
    if (nextName && nextName !== oldName)
      await onRenameOption?.(oldName, nextName, optionId);
  };

  const moveOption = (targetSection: number, targetKey?: string) => {
    if (draggedOption === null || draggedOption === targetKey) return;
    const grouped = Array.from(
      { length: normalizedSectionCount },
      (_, section) =>
        optionsRef.current
          .filter((option) => sectionFor(option) === section)
          .map((option) => option),
    );
    for (const sectionOptions of grouped) {
      const index = sectionOptions.findIndex(
        (option) => optionKey(option) === draggedOption,
      );
      if (index >= 0) sectionOptions.splice(index, 1);
    }
    const targetValues = grouped[targetSection];
    const targetIndex =
      targetKey !== undefined
        ? targetValues.findIndex((option) => optionKey(option) === targetKey)
        : -1;
    const dragged = optionsRef.current.find(
      (option) => optionKey(option) === draggedOption,
    );
    if (!dragged) return;
    if (targetIndex >= 0) targetValues.splice(targetIndex, 0, dragged);
    else targetValues.push(dragged);
    const nextOptions = grouped.flatMap((sectionOptions, section) =>
      sectionOptions.map((option) => ({ ...option, section })),
    );
    const layout = nextOptions.map((option) => ({
      id: option.id,
      value: option.value,
      section: option.section ?? 0,
    }));
    // Assign the ref before scheduling React state so a second drop in the
    // same event burst always starts from this exact arrangement.
    optionsRef.current = nextOptions;
    setEditorOptions(nextOptions);
    localLayoutSnapshotRef.current = optionSnapshot(nextOptions);
    if (localLayoutTimerRef.current !== null)
      window.clearTimeout(localLayoutTimerRef.current);
    // A failed or unavailable persistence request must not leave this menu
    // permanently detached from the shared options.
    localLayoutTimerRef.current = window.setTimeout(() => {
      localLayoutSnapshotRef.current = null;
      localLayoutTimerRef.current = null;
      setLocalLayoutVersion((version) => version + 1);
    }, 1800);
    setDraggedOption(null);
    // The Board applies this layout optimistically. Do not hold the browser's
    // drag interaction open while the queued persistence request completes.
    void onReorderOptions?.(layout);
  };

  const renderOption = (option: BadgeOption, section: number) => {
    const optionColor = option.color ?? "#e5e7eb";
    const allowDelete = canDeleteOption ? canDeleteOption(option.value) : true;
    const isStoredOption = configuredOptions.some(
      (configuredOption) => configuredOption.value === option.value,
    );
    const canDrag =
      editingLabels &&
      Boolean(onReorderOptions) &&
      (isStoredOption || option.value === "");
    return (
      <div
        key={optionKey(option)}
        draggable={canDrag}
        onDragStart={(event) => {
          if (!canDrag) return;
          // The surrounding Board row is also draggable. Keep label sorting
          // scoped to this menu instead of starting a row drag at the same
          // time, which causes the visible rubber-band effect.
          event.stopPropagation();
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", optionKey(option));
          setDraggedOption(optionKey(option));
        }}
        onDragOver={(event) => {
          if (editingLabels && draggedOption !== null) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        onDrop={(event) => {
          if (!editingLabels) return;
          event.preventDefault();
          event.stopPropagation();
          void moveOption(section, optionKey(option));
        }}
        onDragEnd={(event) => {
          event.stopPropagation();
          setDraggedOption(null);
        }}
        className={`relative min-w-0 ${canDrag ? "cursor-grab active:cursor-grabbing" : ""} ${draggedOption === optionKey(option) ? "opacity-40" : ""}`}
      >
        {!editingLabels ? (
          <button
            type="button"
            onClick={() => {
              onChange(option.value, option);
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
          <div className="flex h-9 items-center gap-1 rounded-md border border-gray-200 bg-gray-50 p-1 text-xs text-gray-500">
            {canDrag && (
              <span
                className="flex h-7 w-4 shrink-0 cursor-grab items-center justify-center text-[#0f8da8] active:cursor-grabbing"
                title="Drag to reorder or move section"
              >
                <GripVertical size={15} />
              </span>
            )}
            <button
              type="button"
              onClick={() =>
                setColorEditor(
                  colorEditor === option.value ? null : option.value,
                )
              }
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-white"
              style={{ background: optionColor }}
              title="Change blank label color"
            >
              <PaintBucket size={14} />
            </button>
            <span className="px-1">Blank label</span>
          </div>
        ) : (
          <div className="flex h-9 items-center gap-1 rounded-md border border-gray-200 bg-white p-1">
            {onReorderOptions && (
              <span
                className="flex h-7 w-4 shrink-0 cursor-grab items-center justify-center text-[#0f8da8] active:cursor-grabbing"
                title="Drag to reorder or move section"
              >
                <GripVertical size={15} />
              </span>
            )}
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
              onBlur={() => void rename(option.value, option.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              className="min-w-0 flex-1 px-1 text-xs text-gray-700 outline-none"
            />
            {onDeleteOption && allowDelete && (
              <button
                type="button"
                onClick={() => void onDeleteOption(option.value, option.id)}
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
                onClick={() => {
                  setEditorOptions((current) =>
                    current?.map((entry) =>
                      entry.value === option.value
                        ? { ...entry, color }
                        : entry,
                    ) ?? current,
                  );
                  setColorEditor(null);
                  void onUpdateOptionColor(option.value, color, option.id);
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
  };

  const menu =
    open &&
    createPortal(
      <div
        ref={menuRef}
        style={menuStyle}
        className="max-h-[min(620px,calc(100vh-16px))] overflow-auto rounded-xl border border-gray-200 bg-white p-4 shadow-2xl"
      >
        <div
          className={
            normalizedSectionCount > 1
              ? "grid min-w-max gap-0"
              : "grid grid-cols-1 gap-2 sm:grid-cols-3"
          }
          style={
            normalizedSectionCount > 1
              ? {
                  gridTemplateColumns: `repeat(${normalizedSectionCount}, minmax(${SECTION_WIDTH - 24}px, 1fr))`,
                }
              : undefined
          }
        >
          {optionsBySection.map((sectionOptions, section) => (
            <div
              key={section}
              onDragOver={(event) => {
                if (editingLabels && draggedOption !== null) {
                  event.preventDefault();
                  event.stopPropagation();
                }
              }}
              onDrop={(event) => {
                if (!editingLabels) return;
                event.preventDefault();
                event.stopPropagation();
                void moveOption(section);
              }}
              className={`${normalizedSectionCount > 1 ? `min-h-14 space-y-2 px-3 ${section > 0 ? "border-l border-gray-300" : ""}` : "contents"}`}
            >
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
              setEditingLabels((previous) => {
                const next = !previous;
                setEditorOptions(next ? baseOptions : null);
                return next;
              });
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
            ? readOnlyReason ?? "This field is locked."
            : undefined
        }
        className={`ck h-full w-full whitespace-nowrap font-medium leading-none transition duration-150 ${readOnly ? "cursor-not-allowed opacity-70" : open ? "" : "active:scale-95"} ${small ? "text-[12.6px]" : "text-[12.6px]"}`}
        style={{ background: activeBg, color: "#ffffff", minWidth: 50 }}
      >
        {value}
      </button>
      {menu}
    </>
  );
}
