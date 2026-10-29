/* eslint-disable @next/next/no-img-element -- printed OCF pages require the supplied artwork source. */

type PrintOcfItem = {
  id: string;
  item_name: string | null;
  qty: string | number | null;
  need_by_date?: string | null;
  remarks: string | null;
  image_url: string | null;
  delivery_name?: string | null;
  delivery_address?: string | null;
  delivery_contact_number?: string | null;
  delivery_remarks?: string | null;
};

function formatNeedBy(value?: string | null) {
  if (value === "ASAP") return "ASAP";
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "")
    ? new Date(`${value}T12:00:00`).toLocaleDateString("en-SG")
    : "-";
}

function deliveryDetailsForItem(itemName: string | null, notes: string) {
  const name = itemName?.trim();
  if (!name || !notes.trim()) return "-";
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = notes.match(
    new RegExp(`(?:^|\\n\\n)${escapedName}\\n([\\s\\S]*?)(?=\\n\\n|$)`),
  );
  return match?.[1]?.trim() || "-";
}

function PrintOcfItemPanel({
  item,
  estimatedDeliveryNotes,
}: {
  item: PrintOcfItem;
  estimatedDeliveryNotes: string;
}) {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border border-black p-[3mm] text-[8px] leading-[1.2]">
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-black pb-1">
        <div className="min-w-0">
          <p className="font-bold">{item.item_name || "Unnamed item"}</p>
        </div>
        <dl className="grid shrink-0 grid-cols-[auto_auto] gap-x-1 text-right">
          <dt className="font-semibold">Qty:</dt>
          <dd>{item.qty || "-"}</dd>
          <dt className="font-semibold">NBD:</dt>
          <dd className="whitespace-nowrap">{formatNeedBy(item.need_by_date)}</dd>
        </dl>
      </div>

      <section className="shrink-0 border-b border-black py-1">
        <h2 className="font-bold">Delivery Information</h2>
        <dl className="mt-0.5 grid grid-cols-2 gap-x-3 gap-y-1">
          <div className="min-w-0">
            <dt className="font-semibold">Name</dt>
            <dd className="whitespace-pre-wrap [overflow-wrap:anywhere]">{item.delivery_name || "-"}</dd>
          </div>
          <div className="min-w-0">
            <dt className="font-semibold">Contact</dt>
            <dd className="[overflow-wrap:anywhere]">{item.delivery_contact_number || "-"}</dd>
          </div>
          <div className="col-span-2 min-w-0">
            <dt className="font-semibold">Address</dt>
            <dd className="whitespace-pre-wrap [overflow-wrap:anywhere]">{item.delivery_address || "-"}</dd>
          </div>
          <div className="col-span-2 min-w-0">
            <dt className="font-semibold">Delivery Remarks</dt>
            <dd className="whitespace-pre-wrap [overflow-wrap:anywhere]">{item.delivery_remarks || "-"}</dd>
          </div>
        </dl>
      </section>

      <section className="shrink-0 border-b border-black py-1">
        <h2 className="font-bold">Estimated Delivery Date Details</h2>
        <p className="mt-0.5 whitespace-pre-wrap [overflow-wrap:anywhere]">
          {deliveryDetailsForItem(item.item_name, estimatedDeliveryNotes)}
        </p>
      </section>

      <section className="flex min-h-0 flex-1 flex-col pt-1">
        <h2 className="shrink-0 border-b border-black pb-1 font-bold">Artwork</h2>
        <div className="mt-1 min-h-0 flex-1 overflow-hidden">
          {item.image_url ? (
            <img
              src={item.image_url}
              alt={`Artwork for ${item.item_name || "item"}`}
              className="block h-full min-h-0 w-full object-contain"
            />
          ) : (
            <span className="flex h-full items-center justify-center">-</span>
          )}
        </div>
      </section>
    </section>
  );
}

/** Print-only OCF pages: one complete item, delivery section and artwork per page. */
export function PrintOcfItemPages({
  items,
  projectName,
  companyName,
  salespersonName,
  salespersonEmail,
  generatedAt,
  estimatedDeliveryNotes,
  brandLogoSrc,
}: {
  items: PrintOcfItem[];
  projectName: string;
  companyName: string;
  salespersonName: string;
  salespersonEmail: string;
  generatedAt: string | null;
  estimatedDeliveryNotes: string;
  brandLogoSrc: string;
}) {
  if (!items.length) return null;
  const sheets = Array.from(
    { length: Math.ceil(items.length / 2) },
    (_, index) => items.slice(index * 2, index * 2 + 2),
  );

  return (
    <section
      className="ocf-print-item-pages hidden print:block"
      aria-label="Printable OCF item pages"
    >
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          /* Do not rely solely on Tailwind's print variants here. Safari's
             print compositor can retain display:none from the hidden utility,
             or clip a fixed-height flex child with overflow:hidden. */
          .ocf-print-item-pages {
            display: block !important;
            visibility: visible !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .ocf-print-sheet {
            display: flex !important;
            height: 190mm;
            width: 100%;
            max-width: 277mm;
            overflow: visible !important;
            break-inside: avoid-page;
            page-break-inside: avoid;
          }
          .ocf-print-sheet:not(:last-child) {
            break-after: page;
            page-break-after: always;
          }
          .ocf-print-sheet img {
            max-width: 100% !important;
          }
        }
      `}</style>
      {sheets.map((sheet, sheetIndex) => (
        <article
          key={sheet[0]?.id ?? sheetIndex}
          className={`ocf-print-sheet box-border flex flex-col overflow-hidden text-black print:break-inside-avoid ${
            sheetIndex < sheets.length - 1 ? "print:break-after-page" : ""
          }`}
        >
          {sheetIndex === 0 ? (
            <>
              <header className="flex shrink-0 items-start justify-between border-b-2 border-black pb-2">
                <div>
                  <img
                    src={brandLogoSrc}
                    alt="NanyangGifts"
                    className="h-9 w-auto object-contain object-left"
                  />
                  <p className="mt-0.5 text-[9px] font-semibold">NANYANGGIFTS PTE. LTD.</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold">ORDER CONFIRMATION FORM</p>
                  <p className="mt-1 text-[9px]">
                    <span className="font-semibold">Date:</span>{" "}
                    {generatedAt
                      ? new Date(generatedAt).toLocaleDateString("en-SG")
                      : "-"}
                  </p>
                </div>
              </header>

              <dl className="mt-2 grid shrink-0 grid-cols-2 gap-x-8 gap-y-1 border-b border-black pb-2 text-[8px]">
                <div className="grid min-w-0 grid-cols-[auto_1fr] gap-x-2">
                  <dt className="font-semibold">Project:</dt>
                  <dd className="min-w-0 [overflow-wrap:anywhere]">{projectName || "-"}</dd>
                </div>
                <div className="grid min-w-0 grid-cols-[auto_1fr] gap-x-2">
                  <dt className="font-semibold">Account Manager:</dt>
                  <dd className="min-w-0 [overflow-wrap:anywhere]">{salespersonName || "-"}</dd>
                </div>
                <div className="grid min-w-0 grid-cols-[auto_1fr] gap-x-2">
                  <dt className="font-semibold">Company:</dt>
                  <dd className="min-w-0 [overflow-wrap:anywhere]">{companyName || "-"}</dd>
                </div>
                <div className="grid min-w-0 grid-cols-[auto_1fr] gap-x-2">
                  <dt className="font-semibold">Email:</dt>
                  <dd className="min-w-0 [overflow-wrap:anywhere]">{salespersonEmail || "-"}</dd>
                </div>
              </dl>
            </>
          ) : null}

          <div className="mt-[3mm] flex min-h-0 flex-1 gap-[4mm]">
            {sheet.map((item) => (
              <PrintOcfItemPanel
                key={item.id}
                item={item}
                estimatedDeliveryNotes={estimatedDeliveryNotes}
              />
            ))}
            {sheet.length === 1 ? <div className="flex-1" aria-hidden="true" /> : null}
          </div>
        </article>
      ))}
    </section>
  );
}
