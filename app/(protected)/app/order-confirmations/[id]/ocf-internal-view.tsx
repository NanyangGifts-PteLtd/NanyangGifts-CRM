"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import logo from "./nanyanggifts-gifts-and-merch.png";

type OcfItem = {
    id: string;
    qty: string | number | null;
    item_name: string | null;
    remarks: string | null;
    image_path: string | null;
    image_url: string | null;
    contact_number?: string | null;
    delivery_address?: string | null;
    pl?: string | null;
    sl?: string | null;
};

type Ocf = {
    id: string;
    client_token: string | null;
    status: string | null;
    generated_at: string | null;
    estimated_delivery_notes: string | null;
    remarks_for_delivery: string | null;
    same_address_for_all_items: boolean | null;
    restricted_area: string | null;
    important_notes: string | null;
    client_name_snapshot: string | null;
    company_snapshot: string | null;
    delivery_address: string | null;
    client_contact_number: string | null;
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
    const [deliveryNotes, setDeliveryNotes] = useState(ocf.estimated_delivery_notes ?? "");
    const clientUrl = useMemo(() => {
        if (!ocf.client_token) return "";
        return `${window.location.origin}/ocf/${ocf.client_token}`;
    }, [ocf.client_token]);

    async function copyClientLink() {
        if (!clientUrl) return;
        await navigator.clipboard.writeText(clientUrl);
        alert("Client link copied");
    }
    const router = useRouter();

    async function goBack() {
        if (window.history.length > 1) {
            router.back();
            return;
        }

        router.push("/app");
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
                        <p>
                            <span className="font-semibold">Contact Number:</span>{" "}
                            {ocf.salesperson_contact_number || "-"}
                        </p>
                        <p>
                            <span className="font-semibold">Email:</span> {ocf.salesperson_email || "-"}
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
                                <td className="py-1 text-left text-black break-all">{ocf.salesperson_email || "-"}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <table className="w-full border border-black text-sm">
                    <thead>
                        <tr className="bg-gray-100 text-left">
                            <th className="border border-black px-2 py-2 font-semibold">Item Name</th>
                            <th className="border border-black px-2 py-2 font-semibold">Qty</th>
                            <th className="border border-black px-2 py-2 font-semibold">Contact Number</th>
                            <th className="border border-black px-2 py-2 font-semibold">Remarks Per Item</th>
                            <th className="border border-black px-2 py-2 font-semibold">Delivery Address</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ocf.order_confirmation_items.length > 0 ? (
                            ocf.order_confirmation_items.map((item) => (
                                <tr key={item.id} className="align-top">
                                    <td className="border border-black px-2 py-3">{item.item_name || "-"}</td>
                                    <td className="border border-black px-2 py-3">{item.qty || "-"}</td>
                                    <td className="border border-black px-2 py-3">{item.contact_number || "-"}</td>
                                    <td className="border border-black px-2 py-3">{item.remarks || "-"}</td>
                                    <td className="border border-black px-2 py-3">
                                        {item.delivery_address || ocf.delivery_address || "-"}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={5} className="border border-black px-3 py-4 text-center text-gray-500">
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
                                Client's Company Name:
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
                                Contact Number For Delivery:
                            </td>
                            <td className="px-3 py-2">{ocf.client_contact_number || "-"}</td>
                        </tr>
                        <tr className="border-b border-black">
                            <td className="border-r border-black bg-[#eef2ff] px-3 py-2 font-semibold">
                                Estimated Delivery:
                            </td>
                            <td className="px-3 py-2">
                                <div className="flex flex-col gap-2">
                                    <input
                                        type="text"
                                        value={deliveryNotes}
                                        onChange={(e) => setDeliveryNotes(e.target.value)}
                                        placeholder="Additional delivery info, e.g. Production Lead Time: 2 days, etc."
                                        className="w-full rounded border border-gray-300 px-3 py-2"
                                    />
                                </div>
                            </td>
                        </tr>
                        <tr className="border-b border-black">
                            <td className="border-r border-black bg-[#eef2ff] px-3 py-2 font-semibold">
                                Remarks For Delivery:
                            </td>
                            <td className="px-3 py-2 whitespace-pre-wrap">{ocf.remarks_for_delivery || "-"}</td>
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
                            <td className="px-3 py-2 whitespace-pre-wrap">{ocf.important_notes || ""}</td>
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

                <div className="mt-6 flex flex-wrap gap-3">
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
                        className="rounded bg-[#7BCBD5] px-4 py-2 text-sm font-medium text-white hover:bg-teal-400"
                    >
                        Back
                    </button>
                </div>


                <div className="mt-6 border-t border-gray-200 pt-4 text-sm text-gray-700">
                    <p><span className="font-semibold">Signed at:</span> {ocf.client_signed_at ? new Date(ocf.client_signed_at).toLocaleString() : "-"}</p>
                    <p><span className="font-semibold">Submitted at:</span> {ocf.client_submitted_at ? new Date(ocf.client_submitted_at).toLocaleString() : "-"}</p>
                    <p><span className="font-semibold">Client IP:</span> {ocf.client_ip || "-"}</p>
                    <p><span className="font-semibold">Locked at:</span> {ocf.locked_at ? new Date(ocf.locked_at).toLocaleString() : "-"}</p>
                </div>
            </div>
            <div className="mt-10 break-before-page print:break-before-page">
                {ocf.order_confirmation_items
                    .filter((item) => item.image_url)
                    .map((item) => (
                        <section key={item.id} className="mb-10">
                            <div className="relative mx-auto flex min-h-[85vh] w-full max-w-[1030px] items-center justify-center overflow-hidden rounded border border-gray-300 bg-white p-4 pt-12 print:min-h-[92vh]">
                                <h1 className="absolute text-center top-4 text-base font-normal text-black">
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