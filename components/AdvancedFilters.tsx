"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { ColumnSelectionPicker } from "./ColumnSelectionPicker";

export type AdvancedFilterCondition =
  | "is"
  | "is not"
  | "text is"
  | "text is not"
  | "contains"
  | "does not contain"
  | "starts with"
  | "ends with"
  | "is empty"
  | "is not empty"
  | "is greater than"
  | "is greater than or equal to"
  | "is less than"
  | "is less than or equal to"
  | "is before"
  | "is on or before"
  | "is after"
  | "is on or after";
export type AdvancedFilterRule = {
  id: string;
  column: string;
  condition: AdvancedFilterCondition | "";
  value: string;
  valueOptionId?: string;
};
export type AdvancedFilterLabelOption = {
  id?: string;
  value: string;
  color: string;
  section?: number;
};
export type AdvancedFilterColumn = {
  key: string;
  label: string;
  category:
    "Client" | "Subitem" | "Payment" | "Subpayment" | "Timeline" | "Sample";
  values: string[];
  valueType?: "text" | "number" | "date";
  labelColors?: Record<string, string>;
  labelOptions?: AdvancedFilterLabelOption[];
};
const textConditions: AdvancedFilterCondition[] = [
  "is",
  "is not",
  "text is",
  "text is not",
  "contains",
  "does not contain",
  "starts with",
  "ends with",
  "is empty",
  "is not empty",
];
const numericConditions: AdvancedFilterCondition[] = [
  "is",
  "is not",
  "is greater than",
  "is greater than or equal to",
  "is less than",
  "is less than or equal to",
  "is empty",
  "is not empty",
];
const dateConditions: AdvancedFilterCondition[] = [
  "is",
  "is not",
  "is before",
  "is on or before",
  "is after",
  "is on or after",
  "is empty",
  "is not empty",
];

export const advancedFilterConditionRequiresValue = (
  condition: AdvancedFilterCondition | "",
) => condition !== "is empty" && condition !== "is not empty";

function Combo({
  value,
  placeholder,
  options,
  groups,
  disabled,
  labelColors,
  labelOptions,
  inputMode,
  inputType,
  onChange,
}: {
  value: string;
  placeholder: string;
  options: Array<{ value: string; label: string; id?: string }>;
  groups?: boolean;
  disabled?: boolean;
  labelColors?: Record<string, string>;
  labelOptions?: AdvancedFilterLabelOption[];
  inputMode?: "text" | "numeric";
  inputType?: "text" | "date";
  onChange: (value: string, optionId?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );
  const filtered = typing
    ? options.filter((option) =>
        option.label.toLowerCase().includes(value.toLowerCase()),
      )
    : options;
  const selectedLabelColor =
    labelOptions?.find((option) => option.value === value)?.color ??
    labelColors?.[value];
  const groupedOptions = Array.from(
    filtered.reduce((groupMap, option) => {
      const group = option.value.split(":")[0];
      const entries = groupMap.get(group) ?? [];
      entries.push(option);
      groupMap.set(group, entries);
      return groupMap;
    }, new Map<string, typeof filtered>()),
  );
  const optionButton = (option: (typeof filtered)[number]) => (
    <button
      key={option.id ?? option.value}
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => {
        setTyping(false);
        onChange(option.value, option.id);
        setOpen(false);
      }}
      className={
        labelOptions
          ? "block w-full rounded-sm text-left"
          : "block w-full rounded px-2 py-2 text-left text-sm text-slate-700 hover:bg-sky-50"
      }
    >
      {labelColors?.[option.value] ? (
        <span
          className={
            labelOptions
              ? "flex h-8 w-full items-center justify-center rounded-sm px-2 text-xs font-semibold text-white transition hover:brightness-95"
              : "inline-flex min-h-6 items-center rounded px-2 text-xs font-semibold text-white"
          }
          style={{ backgroundColor: labelColors[option.value] }}
        >
          {option.label}
        </span>
      ) : (
        option.label
      )}
    </button>
  );
  return (
    <div className="relative min-w-0 flex-1">
      <div
        style={
          selectedLabelColor
            ? {
                backgroundColor: selectedLabelColor,
                borderColor: selectedLabelColor,
              }
            : undefined
        }
        className={`flex h-10 items-center rounded-md border border-slate-300 bg-white ${disabled ? "bg-slate-50 text-slate-400" : "focus-within:border-sky-400"}`}
      >
        <input
          disabled={disabled}
          value={value}
          inputMode={inputMode}
          type={inputType ?? "text"}
          onFocus={() => {
            setTyping(false);
            setOpen(true);
          }}
          onChange={(event) => {
            setTyping(true);
            onChange(event.target.value, undefined);
            setOpen(true);
          }}
          placeholder={placeholder}
          className={`min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-slate-400 ${
            selectedLabelColor ? "text-white placeholder:text-white/75" : ""
          }`}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setTyping(false);
            setOpen((current) => !current);
          }}
          className={
            selectedLabelColor ? "px-2 text-white" : "px-2 text-slate-400"
          }
        >
          <ChevronDown size={15} />
        </button>
      </div>
      {open && !disabled && (
        <div
          className={`absolute top-full z-menu mt-1 max-h-[min(520px,70vh)] overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-2xl ${
            labelOptions
              ? "right-0 w-[min(760px,calc(100vw-2rem))]"
              : "left-0 w-full min-w-64"
          }`}
        >
          {labelOptions ? (
            <div
              className="grid min-w-max"
              style={{
                gridTemplateColumns: `repeat(${Math.max(1, ...labelOptions.map((option) => (option.section ?? 0) + 1))}, minmax(180px, 1fr))`,
              }}
            >
              {Array.from({
                length: Math.max(
                  1,
                  ...labelOptions.map((option) => (option.section ?? 0) + 1),
                ),
              }).map((_, section) => (
                <div
                  key={section}
                  className={`min-h-12 space-y-2 px-3 ${section > 0 ? "border-l border-slate-200" : ""}`}
                >
                  {filtered
                    .filter(
                      (option) =>
                        (labelOptions.find(
                          (labelOption) =>
                            labelOption.id === option.id ||
                            labelOption.value === option.value,
                        )?.section ?? 0) === section,
                    )
                    .map(optionButton)}
                </div>
              ))}
            </div>
          ) : groups
            ? groupedOptions.map(([group, groupOptions]) => {
                const collapsed = collapsedGroups.has(group);
                return (
                  <div key={group}>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() =>
                        setCollapsedGroups((current) => {
                          const next = new Set(current);
                          if (next.has(group)) next.delete(group);
                          else next.add(group);
                          return next;
                        })
                      }
                      className="mt-1 flex w-full items-center gap-2 border-t border-slate-100 px-2 py-2.5 text-left text-sm font-semibold uppercase tracking-wide text-slate-600 hover:bg-slate-50"
                    >
                      {collapsed ? (
                        <ChevronRight size={15} />
                      ) : (
                        <ChevronDown size={15} />
                      )}
                      <span className="flex-1">{group}</span>
                      <span className="text-xs font-normal text-slate-400">
                        {groupOptions.length}
                      </span>
                    </button>
                    {!collapsed && groupOptions.map(optionButton)}
                  </div>
                );
              })
            : filtered.map(optionButton)}
          {!filtered.length && (
            <p className="px-3 py-4 text-center text-xs text-slate-400">
              No matching options
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function AdvancedFilters({
  columns,
  rules,
  join,
  onRulesChange,
  onJoinChange,
  onClear,
}: {
  columns: AdvancedFilterColumn[];
  rules: AdvancedFilterRule[];
  join: "and" | "or";
  onRulesChange: (rules: AdvancedFilterRule[]) => void;
  onJoinChange: (join: "and" | "or") => void;
  onClear: () => void;
}) {
  const update = (id: string, changes: Partial<AdvancedFilterRule>) =>
    onRulesChange(
      rules.map((rule) => (rule.id === id ? { ...rule, ...changes } : rule)),
    );
  return (
    <div className="w-[min(1120px,calc(100vw-1rem))] rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-800">
            Advanced filters
          </h3>
          <p className="text-xs text-slate-500">
            Filter clients using client, subitem, and payment fields.
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={!rules.some((rule) => rule.column || rule.value)}
          className="text-sm text-slate-400 hover:text-slate-700 disabled:opacity-40"
        >
          Clear all
        </button>
      </div>
      <div className="space-y-2">
        {rules.map((rule, index) => {
          const selected = columns.find((column) => column.key === rule.column);
          const isNumeric = selected?.valueType === "number";
          const isDate = selected?.valueType === "date";
          const conditionOptions = isNumeric
            ? numericConditions
            : isDate
              ? dateConditions
              : textConditions;
          const needsValue = advancedFilterConditionRequiresValue(
            rule.condition,
          );
          const selectedLabelOptions = selected?.labelOptions;
          const currentLabelValue = rule.valueOptionId
            ? selectedLabelOptions?.find(
                (option) => option.id === rule.valueOptionId,
              )?.value ?? rule.value
            : rule.value;
          return (
            <div key={rule.id} className="flex items-center gap-2">
              <div className="w-20 text-center text-sm text-slate-600">
                {index === 0 ? (
                  "Where"
                ) : index === 1 ? (
                  <select
                    value={join}
                    onChange={(event) =>
                      onJoinChange(event.target.value as "and" | "or")
                    }
                    className="h-10 w-full rounded border border-slate-300 bg-white px-2 text-sm"
                  >
                    <option value="and">And</option>
                    <option value="or">Or</option>
                  </select>
                ) : join === "and" ? (
                  "And"
                ) : (
                  "Or"
                )}
              </div>
              <ColumnSelectionPicker
                value={rule.column}
                placeholder="Column"
                options={columns.map((column) => ({
                  key: column.key,
                  label: column.label,
                  category: column.category,
                }))}
                onChange={(column) =>
                  update(rule.id, {
                    column,
                    condition: column ? "is" : "",
                    value: "",
                    valueOptionId: undefined,
                  })
                }
              />
              <Combo
                disabled={!selected}
                value={rule.condition}
                placeholder="Condition"
                options={conditionOptions.map((condition) => ({
                  value: condition,
                  label: condition,
                }))}
                onChange={(condition) =>
                  update(rule.id, {
                    condition: condition as AdvancedFilterCondition,
                    ...(!advancedFilterConditionRequiresValue(
                      condition as AdvancedFilterCondition,
                    )
                      ? { value: "", valueOptionId: undefined }
                      : {}),
                  })
                }
              />
              <Combo
                disabled={!selected || !needsValue}
                value={needsValue ? currentLabelValue : ""}
                placeholder={needsValue ? "Value" : "No value needed"}
                options={
                  selectedLabelOptions
                    ? selectedLabelOptions.map((option) => ({
                        value: option.value,
                        label: option.value,
                        id: option.id,
                      }))
                    : (selected?.values ?? []).map((value) => ({
                        value,
                        label: value,
                      }))
                }
                labelColors={selected?.labelColors}
                labelOptions={selectedLabelOptions}
                inputMode={isNumeric ? "numeric" : "text"}
                inputType={isDate ? "date" : "text"}
                onChange={(value, valueOptionId) =>
                  update(rule.id, { value, valueOptionId })
                }
              />
              <button
                type="button"
                onClick={() =>
                  onRulesChange(rules.filter((item) => item.id !== rule.id))
                }
                disabled={rules.length === 1}
                className="rounded p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
              >
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() =>
          onRulesChange([
            ...rules,
            { id: crypto.randomUUID(), column: "", condition: "", value: "" },
          ])
        }
        className="mt-5 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-sky-700"
      >
        <Plus size={15} /> New filter
      </button>
    </div>
  );
}
