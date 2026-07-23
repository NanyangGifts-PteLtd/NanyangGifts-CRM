"use client";

export type ShipperRow = {
    id: string;
    subitem_id?: string | null;
    client_id?: string | null;
    shipper_id?: string | null;

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
        { key: "waybill_date", label: "运单日期", editableByPm: false, editableByShipper: true },
        { key: "waybill_number", label: "运单号码", editableByPm: false, editableByShipper: true },
        { key: "pieces", label: "件数", editableByPm: false, editableByShipper: true },
        { key: "chargeable_weight_kg", label: "计费重量（KG）", editableByPm: false, editableByShipper: true },
        { key: "destination", label: "目的地", editableByPm: false, editableByShipper: true },
        { key: "freight_unit_price", label: "单价", editableByPm: false, editableByShipper: true },
        { key: "freight_cost", label: "运费", editableByPm: false, editableByShipper: true },
        { key: "gst", label: "消费税", editableByPm: false, editableByShipper: true },
        { key: "other_fees", label: "其他费用", editableByPm: false, editableByShipper: true },
        { key: "total_cost", label: "总计费用", editableByPm: false, editableByShipper: true },
        { key: "channel", label: "渠道", editableByPm: false, editableByShipper: true },
        { key: "logistics_remarks", label: "备注", editableByPm: false, editableByShipper: true },

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
    ];
    async function saveCell(rowId: string, field: string, value: string) {
        if (mode !== "shipper" || !token) return;

        await fetch("/api/shipper/update", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, rowId, field, value }),
        });
    }

    return (
        <div className="w-full">
            <div className="rounded-md border border-slate-300 bg-white shadow-sm">
                <table className="min-w-[2400px] border-collapse text-[13px] text-black">
                    <thead>
                        <tr>
                            <th className="sticky top-0 z-20 border border-slate-400 bg-white px-3 py-2 text-center whitespace-nowrap">
                                序号
                            </th>

                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    className={`sticky top-0 z-20 border border-slate-400 px-3 py-2 text-center whitespace-nowrap ${col.editableByPm ? "bg-[#4588ed] text-white" : "bg-white text-black"
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
                                    <td className="border border-slate-300 px-3 py-2 text-center whitespace-nowrap">
                                        {index + 1}
                                    </td>

                                    {columns.map((col) => {
                                        const value = row[col.key as keyof ShipperRow];
                                        const editable =
                                            ( (mode === "pm"|| mode === "dev") && col.editableByPm) ||
                                            (mode === "shipper" && col.editableByShipper);

                                        return (
                                            <td
                                                key={col.key}
                                                className="border border-slate-300 px-3 py-2 whitespace-pre-wrap"
                                            >
                                                {editable ? (
                                                    <textarea
                                                        defaultValue={value == null ? "" : String(value)}
                                                        rows={col.key === "delivery_info" ? 5 : 2}
                                                        className="w-full min-w-[120px] resize-y rounded border border-slate-200 px-2 py-1 text-[13px] outline-none focus:border-blue-400"
                                                        onBlur={(e) => {
                                                            void saveCell(String(row.id), col.key, e.target.value);
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