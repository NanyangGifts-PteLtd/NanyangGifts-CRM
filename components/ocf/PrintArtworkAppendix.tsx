/* eslint-disable @next/next/no-img-element -- print output needs the original artwork source, not an optimized thumbnail. */

type ArtworkItem = {
  id: string;
  item_name: string | null;
  qty: string | number | null;
  need_by_date?: string | null;
  remarks: string | null;
  image_url: string | null;
};

function formatNeedBy(value?: string | null) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "")
    ? String(value).split("-").reverse().join("/")
    : value || "-";
}

/**
 * The OCF table retains its compact thumbnail as a quick item reference.
 * This appendix exists only in printed/PDF copies, where each supplied
 * artwork gets a full, legible page without widening the delivery table.
 */
export function PrintArtworkAppendix({ items }: { items: ArtworkItem[] }) {
  const artworkItems = items.filter((item) => Boolean(item.image_url));
  if (!artworkItems.length) return null;

  return (
    <section className="hidden print:block print:break-before-page" aria-label="Artwork reference">
      {artworkItems.map((item, index) => (
        <article
          key={item.id}
          className={`print:break-inside-avoid ${index > 0 ? "print:break-before-page" : ""}`}
        >
          <header className="border-b-2 border-black pb-3">
            <h2 className="text-lg font-bold tracking-wide text-black">
              Artwork Reference
            </h2>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm text-black">
              <dt className="font-semibold">Item:</dt>
              <dd>{item.item_name || "-"}</dd>
              <dt className="font-semibold">Qty:</dt>
              <dd>{item.qty || "-"}</dd>
              <dt className="font-semibold">Need by:</dt>
              <dd>{formatNeedBy(item.need_by_date)}</dd>
              {item.remarks ? (
                <>
                  <dt className="font-semibold">Remarks:</dt>
                  <dd className="whitespace-pre-wrap">{item.remarks}</dd>
                </>
              ) : null}
            </dl>
          </header>
          <div className="mt-5 flex min-h-[8in] items-center justify-center rounded border border-slate-300 p-3">
            <img
              src={item.image_url!}
              alt={`Artwork for ${item.item_name || "item"}`}
              className="max-h-[7.5in] max-w-full object-contain"
            />
          </div>
        </article>
      ))}
    </section>
  );
}
