"use client";

import { useMemo, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";

export type ShipperRow = {
    id: string;
    subitem_id?: string | null;
    client_id?: string | null;
    shipper_id?: string | null;

    serial_number: string | null;
    waybill_date: string | null;
    waybill_number: string | null;
    pieces: number | string | null;
    chargeable_weight_kg: number | string | null;
    destination: string | null;
    freight_unit_price: number | string | null;
    freight_cost: number | string | null;
    gst: number | string | null;
    other_fees: number | string | null;
    total_cost: number | string | null;
    channel: string | null;
    logistics_remarks: string | null;

    ic: string | null;
    info_provided_date: string | null;
    cn_tracking_no: string | null;
    cartons: number | string | null;
    item_name: string | null;
    delivery_info: string | null;
    qty: number | string | null;
    up: number | string | null;
    value: number | string | null;
    sea_or_air: string | null;
    tax_refund: string | null;
    shipper_remarks: string | null;
    samples_by_air: string | null;
    samples_by_sea: string | null;
    air_received: string | null;
    sea_received: string | null;
};

type ShipperGridProps = {
    rows: ShipperRow[];
    mode: "pm" | "shipper" | "dev";
    token?: string;
};

function display(value: unknown) {
    if (value === null || value === undefined || value === "") return "-";
    return String(value);
}

const IMAGE_MARKER = /\[\[shipper-image:(https?:\/\/[^\]]+)\]\]/g;

function parseRemarks(value: unknown) {
    const raw = String(value ?? "");
    const images: string[] = [];
    const text = raw.replace(IMAGE_MARKER, (_match, url: string) => {
        images.push(url);
        return "";
    }).replace(/\n{3,}/g, "\n\n").trim();
    return { text, images };
}

function serializeRemarks(text: string, images: string[]) {
    const markers = images.map((url) => `[[shipper-image:${url}]]`).join("\n");
    return markers ? `${text.trim()}\n\n${markers}`.trim() : text;
}

function RemarksCell({
    row,
    field,
    editable,
    token,
    saveCell,
}: {
    row: ShipperRow;
    field: "logistics_remarks" | "shipper_remarks";
    editable: boolean;
    token?: string;
    saveCell: (row: ShipperRow, field: string, value: string) => Promise<void>;
}) {
    const initial = useMemo(() => parseRemarks(row[field]), [row, field]);
    const [text, setText] = useState(initial.text);
    const [images, setImages] = useState(initial.images);
    const [uploading, setUploading] = useState(false);

    const save = async (nextText = text, nextImages = images) => {
        await saveCell(row, field, serializeRemarks(nextText, nextImages));
    };

    const uploadImage = async (file: File) => {
        if (!file.type.startsWith("image/")) return;
        setUploading(true);
        try {
            const form = new FormData();
            form.append("file", file);
            form.append("subitemId", row.subitem_id ?? "");
            form.append("shipperId", row.shipper_id ?? "");
            form.append("shipperToken", token ?? "");
            const response = await fetch("/api/shipper/upload-image", { method: "POST", body: form });
            const result = await response.json();
            if (!response.ok) throw new Error(result?.error || "Failed to upload image");
            const nextImages = [...images, result.url as string];
            setImages(nextImages);
            await save(text, nextImages);
        } finally {
            setUploading(false);
        }
    };

    const removeImage = async (url: string) => {
        setUploading(true);
        try {
            const response = await fetch("/api/shipper/delete-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result?.error || "Failed to remove image");

            const nextImages = images.filter((image) => image !== url);
            setImages(nextImages);
            await save(text, nextImages);
        } finally {
            setUploading(false);
        }
    };

    const imagePreview = images.map((url) => (
        <div key={url} className="relative mt-2 w-fit max-w-full">
            <a href={url} target="_blank" rel="noreferrer" className="block">
                <img src={url} alt="Attached remark" className="max-h-48 max-w-[240px] rounded border border-slate-200 object-contain" />
            </a>
            <div className="mt-1 text-[11px] leading-4 text-slate-400">点击图片放大</div>
            {editable && (
                <button
                    type="button"
                    onClick={() => void removeImage(url)}
                    disabled={uploading}
                    className="absolute right-1 top-1 rounded bg-white/90 p-1 text-red-500 shadow hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Remove attached image"
                >
                    <Trash2 size={12} />
                </button>
            )}
        </div>
    ));

    if (!editable) return <div>{text || "-"}{imagePreview}</div>;

    return (
        <div className="min-w-[240px]" onPaste={(event) => {
            const image = Array.from(event.clipboardData.files).find((file) => file.type.startsWith("image/"));
            if (image) {
                event.preventDefault();
                void uploadImage(image);
            }
        }}>
            <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={3}
                className="w-full min-w-[50px] resize-y rounded border border-slate-200 px-1 py-1 text-[13px] outline-none focus:border-blue-400"
                onBlur={() => void save()}
            />
            {imagePreview}
            <label className="mt-2 flex cursor-pointer items-center gap-1 whitespace-nowrap text-[11px] leading-4 text-slate-400 hover:text-slate-600">
                <ImagePlus size={12} />
                <span>{uploading ? "加载中..." : "在此粘贴或附上图片"}</span>
                <input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadImage(file);
                    event.target.value = "";
                }} />
            </label>
        </div>
    );
}

export default function ShipperGrid({ rows, mode, token }: ShipperGridProps) {
    const columns = [
        { key: "serial_number", label: "序号", editableByPm: true, editableByShipper: true },
        { key: "waybill_date", label: "运单日期", editableByPm: true, editableByShipper: true },
        { key: "waybill_number", label: "运单号码", editableByPm: true, editableByShipper: true },
        { key: "pieces", label: "件数", editableByPm: true, editableByShipper: true },
        { key: "chargeable_weight_kg", label: "计费重量（KG）", editableByPm: true, editableByShipper: true },
        { key: "destination", label: "目的地", editableByPm: true, editableByShipper: true },
        { key: "freight_unit_price", label: "单价", editableByPm: true, editableByShipper: true },
        { key: "freight_cost", label: "运费", editableByPm: true, editableByShipper: true },
        { key: "gst", label: "消费税", editableByPm: true, editableByShipper: true },
        { key: "other_fees", label: "其他费用", editableByPm: true, editableByShipper: true },
        { key: "total_cost", label: "总计费用", editableByPm: true, editableByShipper: true },
        { key: "channel", label: "渠道", editableByPm: true, editableByShipper: true },
        { key: "logistics_remarks", label: "备注", editableByPm: true, editableByShipper: true, width: 280 },

        { key: "ic", label: "谁下单 / I/C", editableByPm: true, editableByShipper: false },
        { key: "info_provided_date", label: "提供资料日期", editableByPm: true, editableByShipper: false },
        { key: "cn_tracking_no", label: "单号 / CN Tracking #", editableByPm: true, editableByShipper: false },
        { key: "cartons", label: "箱子 / Cartons", editableByPm: true, editableByShipper: false },
        { key: "item_name", label: "货名 / Item name", editableByPm: true, editableByShipper: false },
        { key: "delivery_info", label: "地址 / Address", editableByPm: true, editableByShipper: false },
        { key: "qty", label: "数量 / Qty", editableByPm: true, editableByShipper: false },
        { key: "up", label: "单价 / Unit Price", editableByPm: true, editableByShipper: false },
        { key: "value", label: "货值 / Value", editableByPm: true, editableByShipper: false },
        { key: "sea_or_air", label: "海运、空运 / Sea or Air?", editableByPm: true, editableByShipper: false },
        { key: "tax_refund", label: "退税?", editableByPm: true, editableByShipper: false },
        { key: "shipper_remarks", label: "备注 / Remarks", editableByPm: true, editableByShipper: false, width: 280 },
        { key: "samples_by_air", label: "发样品空运 / Samples to send by air", editableByPm: true, editableByShipper: false },
        { key: "samples_by_sea", label: "发样品海运 / Samples to send by sea", editableByPm: true, editableByShipper: false },
        { key: "air_received", label: "空运收到 / Air received", editableByPm: true, editableByShipper: false },
        { key: "sea_received", label: "海运收到 / Sea received", editableByPm: true, editableByShipper: false },
    ];
    async function saveCell(row: ShipperRow, field: string, value: string) {
        if (!token && !row.shipper_id) return;

        const res = await fetch("/api/shipper/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                subitemId: row.subitem_id,
                shipperId: row.shipper_id,
                shipperToken: token,
                field,
                value,
            }),
        });

        const json = await res.json();
        if (!res.ok) {
            throw new Error(json.error || "Failed to save shipper view row");
        }
    }

    return (
        <div className="w-full">
            <div className="rounded-md border border-slate-300 bg-white shadow-sm">
                <table className="min-w-[2400px] border-collapse text-[13px] text-black">
                    <thead>
                        <tr>
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    style={col.width ? { minWidth: col.width, width: col.width } : undefined}
                                    className={`sticky top-0 z-20 border border-slate-400 px-3 py-2 text-center whitespace-nowrap ${col.editableByShipper ? "bg-white text-black" : "bg-[#4588ed] text-white" 
                                        }`}
                                >
                                    {col.label}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={columns.length + 1}
                                    className="border border-slate-300 px-4 py-6 bg-white text-center text-sm text-slate-500"
                                >
                                    No shipper rows found.
                                </td>
                            </tr>
                        ) : (
                            rows.map((row, index) => (
                                <tr key={row.id} className="bg-white text-black align-top">
                                    {columns.map((col) => {
                                        const value = row[col.key as keyof ShipperRow];
                                        const editable =
                                            ((mode === "pm" || mode === "dev") && col.editableByPm) ||
                                            (mode === "shipper" && col.editableByShipper);

                                        return (
                                            <td
                                                key={col.key}
                                                className="border border-slate-300 px-1 py-2 whitespace-pre-wrap"
                                                style={col.width ? { minWidth: col.width, width: col.width } : undefined}
                                            >
                                                {col.key === "logistics_remarks" || col.key === "shipper_remarks" ? (
                                                    <RemarksCell
                                                        row={row}
                                                        field={col.key}
                                                        editable={editable}
                                                        token={token}
                                                        saveCell={saveCell}
                                                    />
                                                ) : editable ? (
                                                    <textarea
                                                        defaultValue={value == null ? "" : String(value)}
                                                        rows={col.key === "delivery_info" ? 5 : 2}
                                                        className="w-full min-w-[50px] resize-y rounded border border-slate-200 px-1 py-1 text-[13px] outline-none focus:border-blue-400"
                                                        onBlur={(e) => {
                                                            void saveCell(row, col.key, e.target.value);
                                                        }}
                                                    />
                                                ) : (
                                                    display(value)
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}