"use client";
import React, { useState, useRef, useEffect, useLayoutEffect } from "react";

const HTTP_URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>'"`]+/gi;

type DetectedLink = { text: string; href: string };

function supplierLinks(value: string): DetectedLink[] {
  return Array.from(value.matchAll(HTTP_URL_PATTERN)).flatMap((match) => {
    const text = match[0].replace(/[),.;!?]+$/, "");
    if (!text) return [];
    return [{
      text,
      href: text.startsWith("www.") ? `https://${text}` : text,
    }];
  });
}

function LinkifiedText({ value }: { value: string }) {
  const matches = Array.from(value.matchAll(HTTP_URL_PATTERN));
  if (!matches.length) return <>{value}</>;
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  for (const [index, match] of matches.entries()) {
    const rawText = match[0];
    const text = rawText.replace(/[),.;!?]+$/, "");
    const start = match.index ?? cursor;
    const end = start + rawText.length;
    if (start > cursor) nodes.push(value.slice(cursor, start));
    if (text) {
      nodes.push(
        <a
          key={`${start}-${index}`}
          href={text.startsWith("www.") ? `https://${text}` : text}
          target="_blank"
          rel="noopener noreferrer"
          data-inline-editor-link
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          className="text-blue-600 underline underline-offset-2 hover:text-blue-800"
        >
          {text}
        </a>,
      );
    }
    if (text.length < rawText.length) nodes.push(rawText.slice(text.length));
    cursor = end;
  }
  if (cursor < value.length) nodes.push(value.slice(cursor));
  return <>{nodes}</>;
}

export function EditableCell({
  value,
  onChange,
  normalizeOnSave,
  type = "text",
  placeholder = "",
  className = "",
  readOnly = false,
  readOnlyReason,
  multiline = false,
  resizableMultiline = false,
  autoEdit = false,
  fitContent = false,
  onAutoEditStarted,
  onEditingChange,
  recommendations = [],
  recommendedSupplier,
  linkifyUrls = false,
}: {
  value: string;
  /**
   * Persisted board values must be applied to their parent state immediately.
   * Save the server change afterwards (and roll back only that field on
   * failure). Waiting for a request before updating `value` causes the cell
   * to visibly snap back to its old value after blur.
   */
  onChange: (v: string) => void;
  /** Converts a draft to its canonical persisted form before it leaves this cell. */
  normalizeOnSave?: (value: string) => string;
  type?: string;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  readOnlyReason?: string;
  multiline?: boolean;
  resizableMultiline?: boolean;
  autoEdit?: boolean;
  fitContent?: boolean;
  onAutoEditStarted?: () => void;
  onEditingChange?: (editing: boolean) => void;
  recommendations?: string[];
  recommendedSupplier?: string;
  /** Render safe HTTP(S) URLs as links; used by the Supplier field. */
  linkifyUrls?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const savedRef = useRef(false);
  const contentWidth = `${Math.min(Math.max((local || placeholder).length + 1, 4), 48)}ch`;

  useEffect(() => {
    // Realtime snapshots must never replace the user's active draft. Once
    // editing ends, the latest committed prop can safely resynchronise it.
    if (!editing) setLocal(value);
  }, [value, editing]);

  useEffect(() => {
    if (!autoEdit || editing || readOnly) return;
    savedRef.current = false;
    setEditing(true);
    onAutoEditStarted?.();
  }, [autoEdit, editing, readOnly, onAutoEditStarted]);

  useEffect(() => {
    // A field can become temporarily read-only while a background operation
    // finalises it. Do not leave an already-open draft editable or allow it
    // to submit after that lock has taken effect.
    if (!readOnly || !editing) return;
    savedRef.current = true;
    setLocal(value);
    setEditing(false);
  }, [editing, readOnly, value]);

  useEffect(() => {
    onEditingChange?.(editing);
  }, [editing, onEditingChange]);

  useLayoutEffect(() => {
    if (!editing) return;

    if (multiline && textareaRef.current) {
      textareaRef.current.focus();
      if (!resizableMultiline) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }
    }

    if (!multiline && inputRef.current) {
      inputRef.current.focus();
      if (autoEdit) inputRef.current.select();
    }
  }, [autoEdit, editing, multiline, resizableMultiline]);

  useEffect(() => {
    if (!editing || !multiline || resizableMultiline || !textareaRef.current)
      return;

    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
  }, [local, editing, multiline, resizableMultiline]);

  const save = () => {
    if (readOnly || savedRef.current) return;
    savedRef.current = true;
    const nextValue = normalizeOnSave ? normalizeOnSave(local) : local;
    // Keep the editor's own draft canonical too. This avoids one paint of an
    // invalid value while the parent applies its optimistic update.
    if (nextValue !== local) setLocal(nextValue);
    onChange(nextValue);
    setEditing(false);
  };

  useEffect(() => {
    if (!editing) return;
    const closeOnPointerAway = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        (target && inputRef.current?.contains(target)) ||
        (target && textareaRef.current?.contains(target)) ||
        (event.target as HTMLElement | null)?.closest(
          "[data-inline-editor-suggestion], [data-inline-editor-link]",
        )
      )
        return;
      save();
    };
    document.addEventListener("pointerdown", closeOnPointerAway, true);
    return () =>
      document.removeEventListener("pointerdown", closeOnPointerAway, true);
  }, [editing, local, onChange, readOnly]);

  if (editing && multiline) {
    const textarea = (
      <textarea
        ref={textareaRef}
        data-inline-editor
        data-crm-cell-value={local}
        draggable={false}
        value={local}
        rows={resizableMultiline ? 5 : 1}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={save}
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onDragStart={(event) => event.preventDefault()}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !resizableMultiline) save();
          if (e.key === "Escape") {
            savedRef.current = true;
            setLocal(value);
            setEditing(false);
          }
        }}
        className={`w-full px-2 py-1.5 text-xs border border-blue-400 rounded outline-none bg-white ${resizableMultiline ? "absolute left-0 top-0 z-menu h-[260px] min-h-[80px] resize overflow-auto shadow-lg" : "resize-none overflow-hidden"} ${className}`}
        style={{
          minWidth: 40,
          width: resizableMultiline
            ? "min(620px, calc(100vw - 48px))"
            : undefined,
        }}
      />
    );
    const recommended = recommendedSupplier?.trim();
    const links = linkifyUrls ? supplierLinks(local) : [];
    const linkBar = links.length ? (
      <div className="absolute left-0 top-[264px] z-menu flex w-[min(620px,calc(100vw-48px))] flex-wrap gap-2 rounded-b border border-slate-200 bg-white p-2 text-xs shadow-lg">
        {links.map((link, index) => (
          <a
            key={`${link.href}-${index}`}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            data-inline-editor-link
            onPointerDown={(event) => event.stopPropagation()}
            className="max-w-full truncate text-blue-600 underline underline-offset-2 hover:text-blue-800"
            title={`Open ${link.href} in a new tab`}
          >
            {link.text}
          </a>
        ))}
      </div>
    ) : null;
    const matches = recommendations
      .filter(
        (item) =>
          item.toLowerCase().includes(local.trim().toLowerCase()) &&
          item.toLowerCase() !== local.trim().toLowerCase() &&
          item.toLowerCase() !== recommended?.toLowerCase(),
      )
      .slice(0, 4);
    return resizableMultiline ? (
      <div className="relative h-[22px] w-full">
        {textarea}
        {linkBar}
        {(recommended || matches.length > 0) && (
          <div className={`absolute left-0 ${links.length ? "top-[304px]" : "top-[264px]"} z-menu flex w-[min(620px,calc(100vw-48px))] flex-wrap gap-1 rounded-b border border-slate-200 bg-white p-2 shadow-lg`}>
            {recommended && (
              <button
                type="button"
                data-inline-editor-suggestion
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  savedRef.current = true;
                  setLocal(recommended);
                  onChange(recommended);
                  setEditing(false);
                }}
                className="rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-200"
              >
                Recommended supplier: {recommended}
              </button>
            )}
            {matches.map((item) => (
              <button
                key={item}
                type="button"
                data-inline-editor-suggestion
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  savedRef.current = true;
                  setLocal(item);
                  onChange(item);
                  setEditing(false);
                }}
                className="rounded bg-sky-50 px-2 py-1 text-xs text-sky-700 hover:bg-sky-100"
              >
                Use closest match: {item}
              </button>
            ))}
          </div>
        )}
      </div>
    ) : (
      textarea
    );
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        data-inline-editor
        data-crm-cell-value={local}
        draggable={false}
        type={type}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={save}
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onDragStart={(event) => event.preventDefault()}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") {
            savedRef.current = true;
            setLocal(value);
            setEditing(false);
          }
        }}
        className={`${fitContent ? "w-fit max-w-full" : "w-full"} px-1 py-0.5 text-xs border border-blue-400 rounded outline-none bg-white ${className}`}
        style={{ minWidth: 40, ...(fitContent ? { width: contentWidth } : {}) }}
      />
    );
  }

  return (
    <div
      data-editable-cell
      data-crm-cell-value={value}
      onClick={() => {
        if (readOnly) return;
        savedRef.current = false;
        setEditing(true);
      }}
      title={readOnly ? (readOnlyReason ?? value) : value}
      className={`flex ${fitContent ? "w-fit max-w-full" : "w-15"} justify-center py-0.5 text-xs ${readOnly ? "cursor-default" : "cursor-text hover:bg-blue-50"} rounded min-h-[22px] items-center ${
        multiline
          ? "whitespace-nowrap overflow-hidden text-ellipsis"
          : "truncate"
      } ${className}`}
    >
      {value
        ? linkifyUrls
          ? <LinkifiedText value={value} />
          : value
        :
        (placeholder && (
          <span className="text-gray-300 select-none">{placeholder}</span>
        ))}
    </div>
  );
}
