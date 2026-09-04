"use client";

import { FileText } from "lucide-react";

type FilePreviewProps = {
  url: string;
  name: string;
  mimeType?: string;
  size?: "compact" | "large";
  className?: string;
};

const isImage = (url: string, mimeType?: string) =>
  mimeType?.startsWith("image/") ||
  /^data:image\//i.test(url) ||
  /\.(avif|gif|jpe?g|png|svg|webp)(?:$|[?#])/i.test(url);

const isPdf = (url: string, mimeType?: string) =>
  mimeType === "application/pdf" || /\.pdf(?:$|[?#])/i.test(url);

const pdfPageUrl = (url: string) =>
  `${url}${url.includes("#") ? "&" : "#"}page=1&view=FitH&toolbar=0&navpanes=0`;

/**
 * Browser-native file preview. PDFs render their first page in browsers with
 * a PDF viewer; other document formats retain a clear file fallback because
 * their content cannot be safely rendered without a conversion service.
 */
export function FilePreview({
  url,
  name,
  mimeType,
  size = "compact",
  className = "",
}: FilePreviewProps) {
  const dimensions =
    size === "compact"
      ? "h-8 w-9"
      : "h-40 w-48 sm:h-48 sm:w-64";

  if (isImage(url, mimeType)) {
    return (
      <img
        src={url}
        alt={name}
        className={`${dimensions} rounded border border-slate-200 object-cover ${className}`}
      />
    );
  }

  if (isPdf(url, mimeType)) {
    return (
      <div
        className={`${dimensions} overflow-hidden rounded border border-slate-200 bg-white ${className}`}
      >
        <iframe
          src={pdfPageUrl(url)}
          title={`${name} first-page preview`}
          tabIndex={-1}
          loading="lazy"
          className="pointer-events-none h-[calc(100%+18px)] w-[calc(100%+18px)] border-0"
        />
      </div>
    );
  }

  return (
    <div
      className={`${dimensions} flex items-center justify-center rounded border border-sky-200 bg-sky-50 text-sky-700 ${className}`}
      title={name}
    >
      <FileText size={size === "compact" ? 15 : 30} />
    </div>
  );
}
