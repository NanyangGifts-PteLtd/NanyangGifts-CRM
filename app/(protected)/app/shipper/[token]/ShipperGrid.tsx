"use client";

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
        { key: "logistics_remarks", label: "备注", editableByPm: true, editableByShipper: true },

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
        { key: "shipper_remarks", label: "备注 / Remarks", editableByPm: true, editableByShipper: false },
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
                                            >
                                                {editable ? (
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