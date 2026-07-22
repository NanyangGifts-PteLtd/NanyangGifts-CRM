"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import SignatureForm from "./signature-form";
import logo from "./nanyanggifts-gifts-and-merch.png";
import { DEFAULT_IMPORTANT_NOTES } from "@/components/Important-Notes";


type OcfItem = {
    id: string;
    qty: string | number | null;
    item_name: string | null;
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
    client_name_snapshot: string | null;
    company_snapshot: string | null;
    recipient_name: string | null;
    salesperson_name: string | null;
    salesperson_email: string | null;
    salesperson_contact_number: string | null;
    client_signed_at: string | null;
    client_submitted_at: string | null;
    client_ip: string | null;
    locked_at: string | null;
    restricted_area: string | null;
    same_address_for_all_items: boolean | null;
    order_confirmation_items: OcfItem[];
};

type EditableItem = OcfItem & {
    delivery_name: string;
    delivery_address: string;
    delivery_contact_number: string;
    delivery_remarks: string;
};

export default function ClientOcfView({ ocf }: { ocf: Ocf }) {
    const isLocked =
        ocf.status === "submitted" ||
        ocf.status === "locked" ||
        Boolean(ocf.locked_at);

    const importantNotes = ocf.important_notes?.trim() || DEFAULT_IMPORTANT_NOTES;
    const [company, setCompany] = useState(ocf.company_snapshot ?? "");
    const [sameAddressForAllItems, setSameAddressForAllItems] = useState(
        ocf.same_address_for_all_items ?? true
);

    const [items, setItems] = useState<EditableItem[]>(
        ocf.order_confirmation_items.map((item) => ({
            ...item,
            delivery_name: item.delivery_name ?? "",
            delivery_address: item.delivery_address ?? "",
            delivery_contact_number: item.delivery_contact_number ?? "",
            delivery_remarks: item.delivery_remarks ?? "",
        }))
    );

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
          }
    )
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
          }
    )
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
    "delivery_name" | "delivery_address" | "delivery_contact_number" | "delivery_remarks"
  >,
  value: string
) {
  setItems((prev) => {
    const updated = prev.map((row, i) =>
      i === index
        ? {
            ...row,
            [field]: value,
          }
        : row
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
            }
      );
    }

    return updated;
  });
}
    return (
        <main className="min-h-screen bg-[#f3f4f6] px-4 py-8">
            <div className="mx-auto max-w-5xl bg-white p-6 shadow-lg">
                <div className="mb-4 flex items-start justify-between gap-4 border-b border-black pb-4">
                    <div>
                        <Image src={logo} alt="Nanyang Gifts Logo" className="h-14 w-auto object-contain" />
                        <p className="mt-2 text-sm font-semibold text-gray-800">NANYANGGIFTS PTE. LTD.</p>
                    </div>

                    <div className="text-right text-sm text-black">
                        <h1 className="text-base font-bold tracking-wide">ORDER CONFIRMATION FORM</h1>
                        <p className="mt-3">
                            <span className="font-semibold">Date:</span>{" "}
                            {ocf.generated_at ? new Date(ocf.generated_at).toLocaleDateString('en-SG') : "-"}
                        </p>
                    </div>
                </div>

                <div className="mb-4 bg-[#eef2ff] px-4 py-3">
                    <table className="w-full border-collapse text-sm">
                        <tbody>
                            <tr>
                                <td className="w-[18%] py-1 font-semibold text-black">Project Name:</td>
                                <td className="w-[42%] py-1 text-black">{ocf.client_name_snapshot || "-"}</td>
                                <td className="w-[18%] py-1 font-semibold text-black">Account Manager:</td>
                                <td className="w-[22%] py-1 text-left text-black">{ocf.salesperson_name || "-"}</td>
                            </tr>
                            <tr>
                                <td className="py-1 font-semibold text-black">Client&apos;s Company Name:</td>
                                <td className="py-1 text-black">{company || "-"}</td>
                                <td className="py-1 font-semibold text-black">Contact Number:</td>
                                <td className="py-1 text-left text-black">{ocf.salesperson_contact_number || "-"}</td>
                            </tr>
                            <tr>
                                <td className="py-1 font-semibold text-black"></td>
                                <td className="py-1 text-black"></td>
                                <td className="py-1 font-semibold text-black">Email:</td>
                                <td className="py-1 text-left text-black break-all">{ocf.salesperson_email || "-"}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <table className="w-full table-fixed border border-black text-sm">
                    <thead>
                        <tr className="bg-gray-100 text-left">
                            <th className="w-[22%] border border-black px-2 py-2 font-semibold">Item Name</th>
                            <th className="w-[10%] border border-black px-2 py-2 font-semibold">Qty</th>
                            <th className="w-[18%] border border-black px-2 py-2 font-semibold">Remarks</th>
                            <th className="w-[50%] border border-black px-2 py-2 font-semibold">
                                <div className="flex items-center justify-between gap-3">
                                    <span>Delivery Information</span>
                                    <label className="flex items-center gap-2 text-[11px] font-medium text-gray-700">
                                        <input
                                            type="checkbox"
                                            checked={sameAddressForAllItems}
                                            onChange={(e) => handleToggleSameAddress(e.target.checked)}
                                            disabled={isLocked || items.length === 0}
                                            className="h-4 w-4"
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
                                    <td className="border border-black px-2 py-3">{item.item_name || "-"}</td>
                                    <td className="border border-black px-2 py-3">{item.qty || "-"}</td>
                                    <td className="border border-black px-2 py-3">{item.remarks || "-"}</td>
                                    <td className="border border-black px-2 py-3">
                                        <div className="space-y-2">
                                            <div>
                                                <label className="mb-1 block text-xs font-medium text-gray-700">Name</label>
                                                <input
                                                    value={item.delivery_name}
                                                    onChange={(e) => updateItemField(index, "delivery_name", e.target.value)}
                                                    disabled={disabled}
                                                    className="w-full rounded border border-gray-300 px-2 py-1.5 disabled:bg-gray-100"
                                                />
                                            </div>

                                            <div>
                                                <label className="mb-1 block text-xs font-medium text-gray-700">Address</label>
                                                <textarea
                                                    value={item.delivery_address}
                                                    onChange={(e) => updateItemField(index, "delivery_address", e.target.value)}
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
                                                        updateItemField(index, "delivery_contact_number", e.target.value)
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
                                                    onChange={(e) => updateItemField(index, "delivery_remarks", e.target.value)}
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


                <table className="mt-4 w-full border border-black text-sm">
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

                <div className="mt-10 break-before-page print:break-before-page max-w-5xl">
                    <span className="flex bg-[#eef2ff] px-1 rounded-sm py-3 text-black items-center justify-center text-[15px]">𝐈𝐦𝐩𝐨𝐫𝐭𝐚𝐧𝐭 𝐧𝐨𝐭𝐞𝐬, 𝐩𝐥𝐞𝐚𝐬𝐞 𝐫𝐞𝐚𝐝 𝐜𝐚𝐫𝐞𝐟𝐮𝐥𝐥𝐲: </span>

                    <span className="px-3 py-2 whitespace-pre-wrap text-[13px]">{importantNotes}</span>
                </div>

                <div className="mt-6">
                    {isLocked ? (
                        <div className="space-y-2 text-sm text-gray-700">
                            <p>This form has already been submitted.</p>
                            <p>
                                <span className="font-semibold">Signed at:</span>{" "}
                                {ocf.client_signed_at ? new Date(ocf.client_signed_at).toLocaleString() : "-"}
                            </p>
                            <p>
                                <span className="font-semibold">Submitted at:</span>{" "}
                                {ocf.client_submitted_at ? new Date(ocf.client_submitted_at).toLocaleString() : "-"}
                            </p>
                            <p>
                                <span className="font-semibold">Client IP:</span> {ocf.client_ip || "-"}
                            </p>
                        </div>
                    ) : (
                        <SignatureForm
                            ocfId={ocf.id}
                            clientToken={ocf.client_token}
                            company={company}
                            items={items}
                            sameAddressForAllItems={sameAddressForAllItems}
                        />
                    )}
                </div>
            </div>

            <div className="mt-10 break-before-page print:break-before-page">
                {ocf.order_confirmation_items
                    .filter((item) => item.image_url)
                    .map((item) => (
                        <section key={item.id} className="mb-10">
                            <div className="relative mx-auto flex min-h-[85vh] w-full max-w-[1030px] items-center justify-center overflow-hidden rounded border border-gray-300 bg-white p-4 pt-12 print:min-h-[92vh]">
                                <h1 className="absolute top-4 text-center text-base font-normal text-black">
                                    {item.item_name || "Item image"}
                                </h1>

                                <img
                                    src={item.image_url!}
                                    alt={item.item_name || "Uploaded item"}
                                    className="max-h-[80vh] w-auto max-w-full object-contain print:max-h-[88vh]"
                                />
                            </div>
                        </section>
                    ))}
            </div>
        </main>
    );
}