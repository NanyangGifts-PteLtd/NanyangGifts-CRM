"use client";

import { useRef, useState, type DragEvent, type ReactNode } from "react";

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
