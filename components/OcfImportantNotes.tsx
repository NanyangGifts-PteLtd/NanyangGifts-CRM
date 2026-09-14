import { isOcfRichText, sanitizeOcfRichText } from "@/lib/ocf-rich-text";

const SECTION_HEADINGS = new Set([
  "Colour Accuracy",
  "Product Quality",
  "Shipping and Delivery",
  "Additional Charges",
  "𝐂𝐨𝐥𝐨𝐮𝐫 𝐀𝐜𝐜𝐮𝐫𝐚𝐜𝐲",
  "𝐏𝐫𝐨𝐝𝐮𝐜𝐭 𝐐𝐮𝐚𝐥𝐢𝐭𝐲",
  "𝐒𝐡𝐢𝐩𝐩𝐢𝐧𝐠 𝐚𝐧𝐝 𝐃𝐞𝐥𝐢𝐯𝐞𝐫𝐲",
  "𝐀𝐝𝐝𝐢𝐭𝐢𝐨𝐧𝐚𝐥 𝐂𝐡𝐚𝐫𝐠𝐞𝐬",
]);

export default function OcfImportantNotes({
  notes,
  className = "",
}: {
  notes: string;
  className?: string;
}) {
  if (isOcfRichText(notes)) {
    return (
      <div
        className={`${className} [&_p]:mb-3 [&_p]:leading-relaxed [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-[1.2em] [&_h2]:font-bold [&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:font-bold [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_a]:text-cyan-700 [&_a]:underline`}
        dangerouslySetInnerHTML={{ __html: sanitizeOcfRichText(notes) }}
      />
    );
  }

  return (
    <div className={className}>
      {notes.trim().split(/\r?\n/).map((line, index) => {
        const value = line.trim();
        if (!value) return <div key={index} className="h-3" aria-hidden="true" />;

        return SECTION_HEADINGS.has(value) ? (
          <div key={index} className="font-bold text-[1.2em] leading-relaxed">
            {value}
          </div>
        ) : (
          <div key={index} className="leading-relaxed">
            {line}
          </div>
        );
      })}
    </div>
  );
}
