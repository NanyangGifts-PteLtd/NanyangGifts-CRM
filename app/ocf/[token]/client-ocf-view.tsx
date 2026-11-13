"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import SignatureForm from "./signature-form";
import logo from "./nanyanggifts-gifts-and-merch.png";
import { DEFAULT_IMPORTANT_NOTES } from "@/components/Important-Notes";
import OcfImportantNotes from "@/components/OcfImportantNotes";
import { OcfFloatingInstruction } from "@/components/OcfFloatingInstruction";

type OcfItem = {
  id: string;
  qty: string | number | null;
  item_name: string | null;
  need_by_date?: string | null;
  remarks: string | null;
  image_path: string | null;
  image_url: string | null;
  delivery_name?: string | null;
  delivery_address?: string | null;
  delivery_contact_number?: string | null;
  delivery_remarks?: string | null;
  pl?: string | null;
  sl?: string | null;
};

type Ocf = {
  id: string;
  client_token: string;
  status: string | null;
  generated_at: string | null;
  estimated_delivery_notes: string | null;
  important_notes: string | null;
  strict_need_by_warning: string | null;
  strict_need_by_date: boolean | null;
  terms_read: boolean | null;
  terms_agreed: boolean | null;
  artwork_confirmed_item_ids: string[] | null;
  client_name_snapshot: string | null;
  company_snapshot: string | null;
  salesperson_name: string | null;
  salesperson_email: string | null;
  salesperson_contact_number: string | null;
  client_signed_at: string | null;
  client_submitted_at: string | null;
  client_ip: string | null;
  locked_at: string | null;
  same_address_for_all_items: boolean | null;
  order_confirmation_items: OcfItem[];
};

type EditableItem = OcfItem & {
  delivery_name: string;
  delivery_address: string;
  delivery_contact_number: string;
  delivery_remarks: string;
};

const formatNeedBy = (value?: string | null) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value ?? "")
    ? String(value).split("-").reverse().join("/")
    : value || "-";

function PrintCheckbox({ checked }: { checked: boolean }) {
  return <span aria-label={checked ? "Checked" : "Not checked"}>{checked ? "☑" : "☐"}</span>;
}

function ClientOcfPrintLayout({
  ocf,
  company,
  items,
  importantNotes,
  strictNeedByDate,
  termsRead,
  termsAgreed,
  artworkConfirmedIds,
  sameAddressForAllItems,
  isLocked,
  draftSignature,
}: {
  ocf: Ocf;
  company: string;
  items: EditableItem[];
  importantNotes: string;
  strictNeedByDate: boolean;
  termsRead: boolean;
  termsAgreed: boolean;
  artworkConfirmedIds: Set<string>;
  sameAddressForAllItems: boolean;
  isLocked: boolean;
  draftSignature: string | null;
}) {
  return (
    <section className="ocf-client-print hidden print:block">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          .ocf-client-print {
            display: block !important;
            box-sizing: border-box;
            width: calc(100% - 1px);
            color: #000;
          }
          .ocf-client-print * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .ocf-client-print table {
            box-sizing: border-box;
            width: 100%;
            border-collapse: collapse;
          }
          .ocf-client-print .ocf-print-item-table { table-layout: fixed; }
          .ocf-client-print tr, .ocf-client-print .ocf-print-keep { break-inside: avoid; page-break-inside: avoid; }
          .ocf-client-print img { max-width: 100%; }
        }
      `}</style>
      <header className="flex items-start justify-between border-b-2 border-black pb-3 text-sm">
        <div>
          <img src={logo.src} alt="Nanyang Gifts Logo" className="h-12 w-auto" />
          <p className="mt-1 font-semibold">NANYANGGIFTS PTE. LTD.</p>
        </div>
        <div className="text-right">
          <h1 className="font-bold tracking-wide">ORDER CONFIRMATION FORM</h1>
          <p className="mt-2">Date: {ocf.generated_at ? new Date(ocf.generated_at).toLocaleDateString("en-SG") : "-"}</p>
        </div>
      </header>

      <table className="mt-3 bg-[#eef2ff] text-xs">
        <tbody>
          <tr>
            <th className="w-[18%] px-2 py-1.5 text-left">Project Name</th>
            <td className="w-[32%] px-2 py-1.5">{ocf.client_name_snapshot || "-"}</td>
            <th className="w-[18%] px-2 py-1.5 text-left">Account Manager</th>
            <td className="px-2 py-1.5">{ocf.salesperson_name || "-"}</td>
          </tr>
          <tr>
            <th className="px-2 py-1.5 text-left">Client&apos;s Company</th>
            <td className="px-2 py-1.5">{company || "-"}</td>
            <th className="px-2 py-1.5 text-left">Email</th>
            <td className="break-all px-2 py-1.5">{ocf.salesperson_email || "-"}</td>
          </tr>
        </tbody>
      </table>

      <p className="mt-3 text-xs"><PrintCheckbox checked={sameAddressForAllItems} /> Same address for all items</p>
      <table className="ocf-print-item-table mt-2 table-fixed text-xs">
        <thead>
          <tr className="bg-gray-100">
            <th className="w-[22%] border border-black px-2 py-2 text-left">Item</th>
            <th className="w-[7%] border border-black px-2 py-2 text-left">Qty</th>
            <th className="w-[11%] border border-black px-2 py-2 text-left">Need by</th>
            <th className="w-[17%] border border-black px-2 py-2 text-left">Description</th>
            <th className="border border-black px-2 py-2 text-left">Delivery Information</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="align-top">
              <td className="border border-black px-2 py-2">
                <p className="font-semibold">{item.item_name || "-"}</p>
                {item.image_url ? <img src={item.image_url} alt={item.item_name || "Artwork"} className="mt-2 h-auto max-h-[82mm] w-full object-contain" /> : null}
                {item.image_url ? <p className="mt-1 text-[11px]"><PrintCheckbox checked={artworkConfirmedIds.has(item.id)} /> Artwork/image confirmed</p> : null}
              </td>
              <td className="border border-black px-2 py-2">{item.qty || "-"}</td>
              <td className="border border-black px-2 py-2">{formatNeedBy(item.need_by_date)}</td>
              <td className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] border border-black px-2 py-2">{item.remarks || "-"}</td>
              <td className="border border-black px-2 py-2">
                <dl className="space-y-2">
                  <div><dt className="font-semibold">Name</dt><dd className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{item.delivery_name || "-"}</dd></div>
                  <div><dt className="font-semibold">Address</dt><dd className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{item.delivery_address || "-"}</dd></div>
                  <div>
                    <dt className="font-semibold">Contact Number</dt>
                    <dd className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                      {item.delivery_contact_number || "-"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold">Delivery Remarks</dt>
                    <dd className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                      {item.delivery_remarks || "-"}
                    </dd>
                  </div>
                </dl>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="ocf-print-keep mt-4 border border-black p-3 text-xs">
        <h2 className="font-semibold">Estimated Delivery Date</h2>
        <p className="mt-2 whitespace-pre-wrap break-words">{ocf.estimated_delivery_notes || "-"}</p>
      </section>
      <section className="ocf-print-keep mt-4 w-full border border-black text-xs">
        <p className="bg-[#eef2ff] px-3 py-2 font-semibold"><PrintCheckbox checked={strictNeedByDate} /> I have a compulsory/strict Need by Date for the item(s).</p>
        {strictNeedByDate ? <div className="border-t border-amber-300 bg-amber-50 px-3 py-2"><OcfImportantNotes notes={ocf.strict_need_by_warning ?? ""} /></div> : null}
      </section>
      <section className="mt-6 border-t-2 border-black pt-4 text-xs">
        <h2 className="bg-[#eef2ff] px-3 py-2 text-center text-sm font-semibold">Important notes, please read carefully:</h2>
        <OcfImportantNotes notes={importantNotes} className="py-3" />
        <div className="grid grid-cols-2 gap-3">
          <p className="bg-[#eef2ff] px-3 py-2"><PrintCheckbox checked={termsRead} /> I have read the above terms.</p>
          <p className="bg-[#eef2ff] px-3 py-2"><PrintCheckbox checked={termsAgreed} /> I agree with the above terms.</p>
        </div>
      </section>
      <section className="ocf-print-keep mt-5 border-t border-black pt-3 text-xs">
        <p className="font-semibold">Client Signature</p>
        {draftSignature ? <img src={draftSignature} alt="Client signature" className="mt-2 h-auto max-h-20 max-w-[260px] object-contain" /> : null}
        {isLocked ? (
          <p className="mt-1">
            <span className="font-semibold">Signed at:</span>{" "}
            {ocf.client_signed_at
              ? new Date(ocf.client_signed_at).toLocaleString("en-SG")
              : "-"}
          </p>
        ) : null}
      </section>
    </section>
  );
}

export default function ClientOcfView({ ocf }: { ocf: Ocf }) {
  const isLocked =
    ocf.status === "submitted" ||
    ocf.status === "locked" ||
    Boolean(ocf.locked_at);

  const importantNotes = ocf.important_notes?.trim() || DEFAULT_IMPORTANT_NOTES;
  const [company, setCompany] = useState(ocf.company_snapshot ?? "");
  const [strictNeedByDate, setStrictNeedByDate] = useState(
    ocf.strict_need_by_date ?? false,
  );
  const [termsRead, setTermsRead] = useState(ocf.terms_read ?? false);
  const [termsAgreed, setTermsAgreed] = useState(ocf.terms_agreed ?? false);
  const [artworkConfirmedIds, setArtworkConfirmedIds] = useState<Set<string>>(
    () => new Set(ocf.artwork_confirmed_item_ids ?? []),
  );
  const [sameAddressForAllItems, setSameAddressForAllItems] = useState(
    ocf.same_address_for_all_items ?? true,
  );

  const [items, setItems] = useState<EditableItem[]>(
    ocf.order_confirmation_items.map((item) => ({
      ...item,
      delivery_name: item.delivery_name ?? "",
      delivery_address: item.delivery_address ?? "",
      delivery_contact_number: item.delivery_contact_number ?? "",
      delivery_remarks: item.delivery_remarks ?? "",
    })),
  );
  const [expandedImage, setExpandedImage] = useState<{
    src: string;
    alt: string;
  } | null>(null);
  const [draftSignature, setDraftSignature] = useState<string | null>(null);

  useEffect(() => {
    if (sameAddressForAllItems && items.length > 0) {
      mirrorAllDeliveryFieldsFromFirstRow(items);
    }
  }, []);

  function mirrorAllDeliveryFieldsFromFirstRow(nextItems?: EditableItem[]) {
    const source = nextItems ?? items;
    const firstRow = source[0];
    if (!firstRow) return;

    setItems(
      source.map((row, index) =>
        index === 0
          ? row
          : {
              ...row,
              delivery_name: firstRow.delivery_name,
              delivery_address: firstRow.delivery_address,
              delivery_contact_number: firstRow.delivery_contact_number,
              delivery_remarks: firstRow.delivery_remarks,
            },
      ),
    );
  }

  function clearOtherDeliveryFields() {
    setItems((prev) =>
      prev.map((row, index) =>
        index === 0
          ? row
          : {
              ...row,
              delivery_name: "",
              delivery_address: "",
              delivery_contact_number: "",
              delivery_remarks: "",
            },
      ),
    );
  }

  function handleToggleSameAddress(checked: boolean) {
    setSameAddressForAllItems(checked);

    if (checked) {
      mirrorAllDeliveryFieldsFromFirstRow();
    } else {
      clearOtherDeliveryFields();
    }
  }
  function updateItemField(
    index: number,
    field: keyof Pick<
      EditableItem,
      | "delivery_name"
      | "delivery_address"
      | "delivery_contact_number"
      | "delivery_remarks"
    >,
    value: string,
  ) {
    setItems((prev) => {
      const updated = prev.map((row, i) =>
        i === index
          ? {
              ...row,
              [field]: value,
            }
          : row,
      );

      if (sameAddressForAllItems) {
        const firstRow = index === 0 ? updated[0] : prev[0];
        if (!firstRow) return updated;

        return updated.map((row, i) =>
          i === 0
            ? {
                ...updated[0],
              }
            : {
                ...row,
                delivery_name: firstRow.delivery_name,
                delivery_address: firstRow.delivery_address,
                delivery_contact_number: firstRow.delivery_contact_number,
                delivery_remarks: firstRow.delivery_remarks,
              },
        );
      }

      return updated;
    });
  }

  function setArtworkConfirmed(itemId: string, confirmed: boolean) {
    setArtworkConfirmedIds((current) => {
      const next = new Set(current);
      if (confirmed) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }

  function openExpandedImage(src: string, alt: string) {
    setExpandedImage({ src, alt });
  }

  function closeExpandedImage() {
    setExpandedImage(null);
  }

  useEffect(() => {
    if (!expandedImage) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeExpandedImage();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expandedImage]);
  return (
    <main className="ocf-light-document min-h-screen bg-[#f3f4f6] px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-5xl bg-white p-6 shadow-lg print:max-w-none print:p-0 print:shadow-none">
        <ClientOcfPrintLayout
          ocf={ocf}
          company={company}
          items={items}
          importantNotes={importantNotes}
          strictNeedByDate={strictNeedByDate}
          termsRead={termsRead}
          termsAgreed={termsAgreed}
          artworkConfirmedIds={artworkConfirmedIds}
          sameAddressForAllItems={sameAddressForAllItems}
          isLocked={isLocked}
          draftSignature={draftSignature}
        />
        <div className="mb-4 flex items-start justify-between gap-4 border-b border-black pb-4 print:hidden">
          <div>
            <Image
              src={logo}
              alt="Nanyang Gifts Logo"
              loading="eager"
              className="h-14 w-auto object-contain"
            />
            <p className="mt-2 text-sm font-semibold text-gray-800">
              NANYANGGIFTS PTE. LTD.
            </p>
          </div>

          <div className="text-right text-sm text-black">
            <h1 className="text-base font-bold tracking-wide">
              ORDER CONFIRMATION FORM
            </h1>
            <p className="mt-3">
              <span className="font-semibold">Date:</span>{" "}
              {ocf.generated_at
                ? new Date(ocf.generated_at).toLocaleDateString("en-SG")
                : "-"}
            </p>
          </div>
        </div>

        <div className="mb-4 bg-[#eef2ff] px-4 py-3 print:hidden">
          <table className="w-full border-collapse text-sm">
            <tbody>
              <tr>
                <td className="w-[18%] py-1 font-semibold text-black">
                  Project Name:
                </td>
                <td className="w-[42%] py-1 text-black">
                  {ocf.client_name_snapshot || "-"}
                </td>
                <td className="w-[18%] py-1 font-semibold text-black">
                  Account Manager:
                </td>
                <td className="w-[22%] py-1 text-left text-black">
                  {ocf.salesperson_name || "-"}
                </td>
              </tr>
              <tr>
                <td className="py-1 font-semibold text-black">
                  Client&apos;s Company Name:
                </td>
                <td className="py-1 text-black">{company || "-"}</td>
                <td className="py-1 font-semibold text-black">Email:</td>
                <td className="py-1 text-left text-black break-all">
                  {ocf.salesperson_email || "-"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="relative print:hidden">
          <OcfFloatingInstruction side="left" step={1} className="top-16">
            Please check and verify any Item Artwork(s). Click an image to enlarge
          </OcfFloatingInstruction>
          <OcfFloatingInstruction side="right" step={2} className="top-16">
            Please fill in your Delivery Information
          </OcfFloatingInstruction>
          <table className="w-full table-fixed border border-black text-sm">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="w-[20%] border border-black px-2 py-2 font-semibold">
                Item Name
              </th>
              <th className="w-[8%] border border-black px-2 py-2 font-semibold">
                Qty
              </th>
              <th className="w-[11%] border border-black px-2 py-2 font-semibold">
                Need by
              </th>
              <th className="w-[16%] border border-black px-2 py-2 font-semibold">
                Description
              </th>
              <th className="w-[45%] border border-black px-2 py-2 font-semibold">
                <div className="flex items-center justify-between gap-3">
                  <span>Delivery Information</span>
                  <label className="flex items-center gap-2 text-[11px] font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={sameAddressForAllItems}
                      onChange={(e) =>
                        handleToggleSameAddress(e.target.checked)
                      }
                      disabled={isLocked || items.length === 0}
                      className="h-4 w-4 accent-[#7BCBD5]"
                    />
                    <span>Same address for all items?</span>
                  </label>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const disableSharedRow = sameAddressForAllItems && index !== 0;
              const disabled = isLocked || disableSharedRow;

              return (
                <tr key={item.id} className="align-top">
                  <td className="border border-black px-2 py-3 align-top">
                    <div className="space-y-2">
                      <div className="font-medium text-black">
                        {item.item_name || "-"}
                      </div>
                      {item.image_url ? (
                        <button
                          type="button"
                          onClick={() =>
                            openExpandedImage(
                              item.image_url!,
                              item.item_name || "Uploaded item",
                            )
                          }
                          className="block w-full text-left"
                          title="Click to enlarge"
                        >
                          <img
                            src={item.image_url}
                            alt={item.item_name || "Uploaded item"}
                            className="max-h-28 max-w-full rounded border border-gray-300 object-contain shadow-sm transition hover:opacity-90"
                          />
                        </button>
                      ) : null}
                      {item.image_url ? (
                        <div className="text-xs text-red-600">
                          <span className="print:hidden">Click image to enlarge</span>
                          <span className="hidden print:inline">Full image at the end</span>
                        </div>
                      ) : null}
                      {item.image_url ? (
                        <label
                          className={`flex w-full items-start gap-2 rounded border border-gray-200 px-2 py-2 text-xs font-medium ${isLocked ? "cursor-default bg-gray-50" : "cursor-pointer hover:bg-gray-50"}`}
                        >
                          <input
                            type="checkbox"
                            checked={artworkConfirmedIds.has(item.id)}
                            onChange={(event) =>
                              setArtworkConfirmed(item.id, event.target.checked)
                            }
                            disabled={isLocked}
                            className="mt-0.5 h-4 w-4 shrink-0 accent-[#7BCBD5]"
                          />
                          <span>I have confirmed the artwork/image.</span>
                        </label>
                      ) : null}
                    </div>
                  </td>
                  <td className="border border-black px-2 py-3">
                    {item.qty || "-"}
                  </td>
                  <td className="border border-black px-2 py-3 font-medium">
                    {formatNeedBy(item.need_by_date)}
                  </td>
                  <td className="border border-black px-2 py-3">
                    {item.remarks || "-"}
                  </td>
                  <td className="border border-black px-2 py-3">
                    <div className="space-y-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-700">
                          Name
                        </label>
                        <input
                          value={item.delivery_name}
                          onChange={(e) =>
                            updateItemField(
                              index,
                              "delivery_name",
                              e.target.value,
                            )
                          }
                          disabled={disabled}
                          className="w-full rounded border border-gray-300 px-2 py-1.5 disabled:bg-gray-100"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-700">
                          Address
                        </label>
                        <textarea
                          value={item.delivery_address}
                          onChange={(e) =>
                            updateItemField(
                              index,
                              "delivery_address",
                              e.target.value,
                            )
                          }
                          disabled={disabled}
                          rows={2}
                          className="w-full rounded border border-gray-300 px-2 py-1.5 disabled:bg-gray-100"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-700">
                          Contact Number
                        </label>
                        <input
                          value={item.delivery_contact_number}
                          onChange={(e) =>
                            updateItemField(
                              index,
                              "delivery_contact_number",
                              e.target.value,
                            )
                          }
                          disabled={disabled}
                          className="w-full rounded border border-gray-300 px-2 py-1.5 disabled:bg-gray-100"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-700">
                          Delivery Remarks
                        </label>
                        <textarea
                          value={item.delivery_remarks}
                          onChange={(e) =>
                            updateItemField(
                              index,
                              "delivery_remarks",
                              e.target.value,
                            )
                          }
                          disabled={disabled}
                          rows={2}
                          className="w-full rounded border border-gray-300 px-2 py-1.5 disabled:bg-gray-100"
                        />
                      </div>

                      {disableSharedRow ? (
                        <p className="text-xs text-gray-500">
                          Using the same delivery information as the first item.
                        </p>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          </table>
        </div>

        <table className="mt-4 w-full border border-black text-sm print:hidden">
          <tbody>
            <tr className="border-b border-black">
              <td className="border-r border-black bg-[#eef2ff] px-3 py-2 font-semibold">
                Estimated Delivery Date:
              </td>
              <td className="px-3 py-2">
                <div className="space-y-z">
                  <textarea
                    value={ocf.estimated_delivery_notes || ""}
                    disabled
                    rows={10}
                    className="w-full whitespace-prewrap rounded border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="relative mt-4 border border-gray-300 text-sm print:hidden">
          <OcfFloatingInstruction side="right" step={3} className="top-1/2">
            [Optional] Please tick here if you have a strict Need By Date
          </OcfFloatingInstruction>
          <label
            className={`flex w-full cursor-pointer items-center justify-center gap-3 px-4 py-3 font-semibold text-black ${isLocked ? "cursor-default bg-gray-100" : "bg-[#eef2ff] hover:bg-[#e4eaff]"}`}
          >
            <input
              type="checkbox"
              checked={strictNeedByDate}
              onChange={(event) => setStrictNeedByDate(event.target.checked)}
              disabled={isLocked}
              className="h-4 w-4 shrink-0 accent-[#7BCBD5]"
            />
            <span>
              I have a compulsory/strict Need by Date for the item(s).
            </span>
          </label>
          {strictNeedByDate ? (
            <div className="border-t border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
              <OcfImportantNotes notes={ocf.strict_need_by_warning ?? ""} />
            </div>
          ) : null}
        </div>

        <div className="relative mt-10 max-w-5xl print:hidden">
          <span className="flex bg-[#eef2ff] px-1 rounded-sm py-3 text-black items-center justify-center text-[15px]">
            𝐈𝐦𝐩𝐨𝐫𝐭𝐚𝐧𝐭 𝐧𝐨𝐭𝐞𝐬, 𝐩𝐥𝐞𝐚𝐬𝐞 𝐫𝐞𝐚𝐝 𝐜𝐚𝐫𝐞𝐟𝐮𝐥𝐥𝐲:{" "}
          </span>

          <OcfImportantNotes
            notes={importantNotes}
            className="py-2 text-[13px]"
          />

          <div className="relative mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <OcfFloatingInstruction side="left" step={4} className="top-1/2">
              Please read the above terms and confirm here
            </OcfFloatingInstruction>
            <label
              className={`flex min-h-12 w-full items-center justify-center gap-3 rounded border px-4 py-3 text-sm font-semibold ${isLocked ? "cursor-default bg-gray-100" : "cursor-pointer bg-[#eef2ff] hover:bg-[#e4eaff]"}`}
            >
              <input
                type="checkbox"
                checked={termsRead}
                onChange={(event) => {
                  setTermsRead(event.target.checked);
                  if (!event.target.checked) setTermsAgreed(false);
                }}
                disabled={isLocked}
                className="h-4 w-4 shrink-0 accent-[#7BCBD5]"
              />
              <span>I have read the above terms.</span>
            </label>
            <label
              className={`flex min-h-12 w-full items-center justify-center gap-3 rounded border px-4 py-3 text-sm font-semibold ${isLocked || !termsRead ? "cursor-not-allowed bg-gray-100 text-gray-400" : "cursor-pointer bg-[#eef2ff] hover:bg-[#e4eaff]"}`}
            >
              <input
                type="checkbox"
                checked={termsAgreed}
                onChange={(event) => setTermsAgreed(event.target.checked)}
                disabled={isLocked || !termsRead}
                className="h-4 w-4 shrink-0 accent-[#7BCBD5]"
              />
              <span>I agree with the above terms.</span>
            </label>
          </div>
        </div>

        <div className="relative mt-6 print:hidden">
          <OcfFloatingInstruction side="right" step={5} className="top-1/2">
            Please sign and submit here
          </OcfFloatingInstruction>
          {isLocked ? (
            <div className="space-y-2 text-sm text-gray-700 print:hidden">
              <p>This form has already been submitted.</p>
              <p>
                <span className="font-semibold">Signed at:</span>{" "}
                {ocf.client_signed_at
                  ? new Date(ocf.client_signed_at).toLocaleString("en-SG")
                  : "-"}
              </p>
              <p>
                <span className="font-semibold">Submitted at:</span>{" "}
                {ocf.client_submitted_at
                  ? new Date(ocf.client_submitted_at).toLocaleString("en-SG")
                  : "-"}
              </p>
              <p>
                <span className="font-semibold">Client IP:</span>{" "}
                {ocf.client_ip || "-"}
              </p>
            </div>
          ) : (
            <SignatureForm
              ocfId={ocf.id}
              clientToken={ocf.client_token}
              company={company}
              items={items}
              sameAddressForAllItems={sameAddressForAllItems}
              strictNeedByDate={strictNeedByDate}
              termsRead={termsRead}
              termsAgreed={termsAgreed}
              artworkConfirmedItemIds={[...artworkConfirmedIds]}
              confirmationsComplete={
                termsRead &&
                termsAgreed &&
                items
                  .filter((item) => Boolean(item.image_url))
                  .every((item) => artworkConfirmedIds.has(item.id))
              }
              onSignatureChange={setDraftSignature}
            />
          )}
          {isLocked ? (
            <div className="hidden items-start justify-between gap-6 text-sm print:flex">
              <p>
                <span className="font-semibold">Client Signature:</span>{" "}
                Signed
              </p>
              <p className="shrink-0 text-gray-700">
                <span className="font-semibold">Signed at:</span>{" "}
                {ocf.client_signed_at
                  ? new Date(ocf.client_signed_at).toLocaleString("en-SG")
                  : "-"}
              </p>
            </div>
          ) : null}
        </div>

        <div className="mt-8 flex justify-center border-t border-gray-200 pt-5 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded bg-slate-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Print / Download OCF
          </button>
        </div>

      </div>

      {expandedImage ? (
        <div
          className="fixed inset-0 z-modal flex items-center justify-center bg-black/70 p-4"
          onClick={closeExpandedImage}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative max-h-[92vh] w-full max-w-5xl overflow-auto rounded-lg bg-white p-3 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeExpandedImage}
              className="absolute right-3 top-3 rounded-full bg-black/70 px-3 py-1 text-sm font-medium text-white hover:bg-black"
            >
              Close
            </button>
            <div className="flex items-center justify-center pt-8">
              <img
                src={expandedImage.src}
                alt={expandedImage.alt}
                className="max-h-[85vh] w-auto max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
