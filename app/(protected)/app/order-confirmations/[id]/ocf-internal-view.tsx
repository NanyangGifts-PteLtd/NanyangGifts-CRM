"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
    client_token: string | null;
    status: string | null;
    generated_at: string | null;
    estimated_delivery_notes: string | null;
    same_address_for_all_items: boolean | null;
    restricted_area: string | null;
    important_notes: string | null;
    client_name_snapshot: string | null;
    company_snapshot: string | null;
    recipient_name: string | null;
    salesperson_name: string | null;
    salesperson_email: string | null;
    salesperson_contact_number: string | null;
    client_signed_at: string | null;
    client_signature_path: string | null;
    client_signature_url?: string | null;
    client_submitted_at: string | null;
    client_ip: string | null;
    locked_at: string | null;
    order_confirmation_items: OcfItem[];
};

export default function OcfInternalView({ ocf }: { ocf: Ocf }) {
    const router = useRouter();

    const [deliveryNotes, setDeliveryNotes] = useState(ocf.estimated_delivery_notes ?? "");
    const [items, setItems] = useState(
        ocf.order_confirmation_items.map((item) => ({
            ...item,
            remarks: item.remarks ?? "",
        }))
    );
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const importantNotes = ocf.important_notes?.trim() || DEFAULT_IMPORTANT_NOTES;

    const clientUrl = useMemo(() => {
        if (!ocf.client_token || typeof window === "undefined") return "";
        return `${window.location.origin}/ocf/${ocf.client_token}`;
    }, [ocf.client_token]);

    async function copyClientLink() {
        if (!clientUrl) return;
        await navigator.clipboard.writeText(clientUrl);
        alert("Client link copied");
    }

    async function goBack() {
        if (window.history.length > 1) {
            router.back();
            return;
        }

        router.push("/app");
    }

    function updateItemRemarks(itemId: string, value: string) {
        setItems((prev) =>
            prev.map((item) =>
                item.id === itemId
                    ? {
                        ...item,
                        remarks: value,
                    }
                    : item
            )
        );
    }

    async function saveInternalEdits() {
        setSaving(true);
        setSaveMessage(null);
        setSaveError(null);

        try {
            const response = await fetch("/api/order-confirmations/update", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    ocfId: ocf.id,
                    estimatedDeliveryNotes: deliveryNotes,
                    items: items.map((item) => ({
                        id: item.id,
                        remarks: item.remarks ?? "",
                    })),
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result?.error || "Failed to save internal updates.");
            }

            setSaveMessage("Changes saved successfully.");
            router.refresh();
        } catch (err: any) {
            setSaveError(err.message || "Failed to save internal updates.");
        } finally {
            setSaving(false);
        }
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
                            {ocf.generated_at ? new Date(ocf.generated_at).toLocaleDateString() : "-"}
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
                                <td className="py-1 text-black">{ocf.company_snapshot || "-"}</td>
                                <td className="py-1 font-semibold text-black">Contact Number:</td>
                                <td className="py-1 text-left text-black">{ocf.salesperson_contact_number || "-"}</td>
                            </tr>
                            <tr>
                                <td className="py-1 font-semibold text-black"></td>
                                <td className="py-1 text-black"></td>
                                <td className="py-1 font-semibold text-black">Email:</td>
                                <td className="py-1 text-left break-all text-black">{ocf.salesperson_email || "-"}</td>
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
                            <th className="w-[50%] border border-black px-2 py-2 font-semibold">Delivery Information</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.length > 0 ? (
                            items.map((item) => (
                                <tr key={item.id} className="align-top">
                                    <td className="border border-black px-2 py-3 break-words">{item.item_name || "-"}</td>
                                    <td className="border border-black px-2 py-3">{item.qty || "-"}</td>
                                    <td className="border border-black px-2 py-3">
                                        <textarea
                                            value={item.remarks ?? ""}
                                            onChange={(e) => updateItemRemarks(item.id, e.target.value)}
                                            rows={4}
                                            className="w-full min-w-0 rounded border border-gray-300 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:ring-offset-2"
                                            placeholder="Item remarks"
                                        />
                                    </td>
                                    <td className="border border-black px-2 py-3">
                                        <div className="space-y-2 text-sm text-gray-800">
                                            <div>
                                                <span className="font-semibold">Name:</span> {item.delivery_name || "-"}
                                            </div>
                                            <div className="whitespace-pre-wrap break-words">
                                                <span className="font-semibold">Address:</span> {item.delivery_address || "-"}
                                            </div>
                                            <div>
                                                <span className="font-semibold">Contact Number:</span>{" "}
                                                {item.delivery_contact_number || "-"}
                                            </div>
                                            <div className="whitespace-pre-wrap break-words">
                                                <span className="font-semibold">Remarks:</span> {item.delivery_remarks || "-"}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={4} className="border border-black px-3 py-4 text-center text-gray-500">
                                    No awarded items found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>

                <table className="mt-4 w-full border border-black text-sm">
                    <tbody>
                        <tr className="border-b border-black">
                            <td className="w-56 border-r border-black bg-[#eef2ff] px-3 py-2 font-semibold">
                                Client&apos;s Company Name:
                            </td>
                            <td className="px-3 py-2">{ocf.company_snapshot || "-"}</td>
                        </tr>

                        <tr className="border-b border-black">
                            <td className="border-r border-black bg-[#eef2ff] px-3 py-2 font-semibold">
                                Recipient Name:
                            </td>
                            <td className="px-3 py-2">{ocf.recipient_name || "-"}</td>
                        </tr>

                        <tr className="border-b border-black">
                            <td className="border-r border-black bg-[#eef2ff] px-3 py-2 font-semibold">
                                Same delivery information for all items?
                            </td>
                            <td className="px-3 py-2">
                                {ocf.same_address_for_all_items ? "Yes" : "No"}
                            </td>
                        </tr>

                        <tr className="border-b border-black">
                            <td className="border-r border-black bg-[#eef2ff] px-3 py-2 font-semibold">
                                Estimated Delivery Notes:
                            </td>
                            <td className="px-3 py-2">
                                <textarea
                                            value={deliveryNotes ?? ""}
                                            onChange={(e) => setDeliveryNotes(e.target.value)}
                                            rows={4}
                                            className="w-full min-w-0 rounded border border-gray-300 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:ring-offset-2"
                                            placeholder="Estimated delivery notes"
                                        />
                            </td>
                        </tr>

                        <tr className="border-b border-black">
                            <td className="border-r border-black bg-[#eef2ff] px-3 py-2 font-semibold">
                                Restricted Area?
                            </td>
                            <td className="px-3 py-2 whitespace-pre-wrap">{ocf.restricted_area || "-"}</td>
                        </tr>

                        <tr className="border-b border-black">
                            <td className="border-r border-black bg-[#eef2ff] px-3 py-2 font-semibold">
                                Important Notes:
                            </td>
                            <td className="px-3 py-2 whitespace-pre-wrap">{importantNotes}</td>
                        </tr>
                    </tbody>
                </table>

                {ocf.client_signature_url ? (
                    <div className="mt-3">
                        <p className="mb-2 font-semibold text-gray-800">Client Signature:</p>
                        <img
                            src={ocf.client_signature_url}
                            alt="Client signature"
                            className="max-h-40 rounded border border-gray-300 bg-white"
                        />
                    </div>
                ) : (
                    <p>
                        <span className="font-semibold">Client Signature:</span> -
                    </p>
                )}

                {saveError ? <p className="mt-4 text-sm text-red-600">{saveError}</p> : null}
                {saveMessage ? <p className="mt-4 text-sm text-green-600">{saveMessage}</p> : null}

                <div className="mt-6 flex flex-wrap gap-3">
                    <button
                        type="button"
                        onClick={saveInternalEdits}
                        disabled={saving}
                        className="rounded bg-[#7BCBD5] px-4 py-2 text-sm font-medium text-white hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {saving ? "Saving..." : "Save Changes"}
                    </button>

                    <button
                        type="button"
                        onClick={copyClientLink}
                        className="rounded bg-blue-400 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
                    >
                        Copy Client Link
                    </button>

                    <button
                        type="button"
                        onClick={goBack}
                        className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        Back
                    </button>
                </div>

                <div className="mt-6 border-t border-gray-200 pt-4 text-sm text-gray-700">
                    <p><span className="font-semibold">Signed at:</span> {ocf.client_signed_at ? new Date(ocf.client_signed_at).toLocaleString('en-SG') : "-"}</p>
                    <p><span className="font-semibold">Submitted at:</span> {ocf.client_submitted_at ? new Date(ocf.client_submitted_at).toLocaleString('en-SG') : "-"}</p>
                    <p><span className="font-semibold">Client IP:</span> {ocf.client_ip || "-"}</p>
                    <p><span className="font-semibold">Locked at:</span> {ocf.locked_at ? new Date(ocf.locked_at).toLocaleString('en-SG') : "-"}</p>
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