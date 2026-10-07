"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
} from "react";
import { Paperclip, Upload } from "lucide-react";

export function EmptyFileDropPrompt({
  onFiles,
  disabled = false,
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}) {
  const selectFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length) onFiles(files);
    event.target.value = "";
  };

  return (
    <label
      className={`flex min-h-28 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-sky-200 bg-sky-50/40 px-4 py-5 text-center text-sky-700 transition hover:border-sky-400 hover:bg-sky-50 ${
        disabled ? "cursor-not-allowed opacity-50" : ""
      }`}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-100 text-sky-600">
        <Paperclip size={21} />
      </span>
      <span className="mt-2 flex items-center gap-1.5 text-sm font-semibold">
        <Upload size={15} /> Add files
      </span>
      <span className="mt-1 text-xs text-sky-600">
        Drag and drop files anywhere in this box, or click to browse
      </span>
      <input
        type="file"
        multiple
        disabled={disabled}
        className="hidden"
        onChange={selectFiles}
      />
    </label>
  );
}

export function FileDropTarget({ children, onFiles, disabled = false, className = "" }: {
  children: ReactNode;
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);

  const prevent = (event: DragEvent<HTMLDivElement>) => {
    if (disabled || !event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  return <div
    className={`relative ${className} ${isDragging ? "ring-2 ring-sky-400 ring-inset bg-sky-50/70" : ""}`}
    onDragEnter={(event) => {
      prevent(event);
      if (disabled || !event.dataTransfer.types.includes("Files")) return;
      dragDepth.current += 1;
      setIsDragging(true);
    }}
    onDragOver={prevent}
    onDragLeave={(event) => {
      if (disabled || !event.dataTransfer.types.includes("Files")) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setIsDragging(false);
    }}
    onDrop={(event) => {
      prevent(event);
      dragDepth.current = 0;
      setIsDragging(false);
      const files = Array.from(event.dataTransfer.files);
      if (!disabled && files.length) onFiles(files);
    }}
  >
    {children}
    {isDragging && <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-inherit border-2 border-dashed border-sky-500 bg-sky-50/90 text-sm font-semibold text-sky-700">Drop file{`(s)`} here to add</div>}
  </div>;
}
