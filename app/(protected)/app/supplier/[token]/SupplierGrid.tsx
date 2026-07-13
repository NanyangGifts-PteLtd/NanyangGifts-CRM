"use client";

export type SupplierRow = {
    id: string | number;
    name: string | null;
    qty: number | string | null;
    supplier: string | null;
    cost: number | string | null;
    ls: number | string | null;
    os: number | string | null;
    tc: number | string | null;
    uc: number | string | null;
    tc_sgd: number | string | null;
    price: number | string | null;
    up: number | string | null;
};

function display(value: unknown) {
    if (value === null || value === undefined || value === "") return "-";
    return String(value);
}

export default function SupplierGrid({ rows }: { rows: SupplierRow[] }) {
    return (
        <div className="w-full">
            <div className="overflow-x-auto rounded-md border border-slate-300 bg-[#346beb] shadow-sm">
                <table className="min-w-[1800px] border-collapse text-[15px] text-white">
                    <thead>
                        <tr>
                            <th className="sticky top-0 z-20 border border-slate-400 bg-[#4588ed] px-3 py-2 text-center font-serif whitespace-nowrap">
                                谁下单
                                <br />
                                I/C
                            </th>
                            <th className="sticky top-0 z-20 border border-slate-400 bg-[#4588ed] px-3 py-2 text-center font-serif whitespace-nowrap">
                                提供资料日期
                            </th>
                            <th className="sticky top-0 z-20 border border-slate-400 bg-[#4588ed] px-3 py-2 text-center font-serif whitespace-nowrap">
                                单号
                                <br />
                                Tracking ID
                            </th>
                            <th className="sticky top-0 z-20 border border-slate-400 bg-[#4588ed] px-3 py-2 text-center font-serif whitespace-nowrap">
                                箱子
                                <br />
                                Cartons
                            </th>
                            <th className="sticky top-0 z-20 border border-slate-400 bg-[#4588ed] px-3 py-2 text-center font-serif whitespace-nowrap">
                                货名
                                <br />
                                Item name
                            </th>
                            <th className="sticky top-0 z-20 border border-slate-400 bg-[#4588ed] px-3 py-2 text-center font-serif whitespace-nowrap">
                                地址
                                <br />
                                Address
                            </th>
                            <th className="sticky top-0 z-20 border border-slate-400 bg-[#4588ed] px-3 py-2 text-center font-serif whitespace-nowrap">
                                数量
                                <br />
                                Qty
                            </th>
                            <th className="sticky top-0 z-20 border border-slate-400 bg-[#4588ed] px-3 py-2 text-center font-serif whitespace-nowrap">
                                单价
                                <br />
                                Unit Price
                            </th>
                            <th className="sticky top-0 z-20 border border-slate-400 bg-[#4588ed] px-3 py-2 text-center font-serif whitespace-nowrap">
                                货值
                                <br />
                                Value
                            </th>
                            <th className="sticky top-0 z-20 border border-slate-400 bg-[#4588ed] px-3 py-2 text-center font-serif whitespace-nowrap">
                                海运、空运
                                <br />
                                Sea or Air?
                            </th>
                            <th className="sticky top-0 z-20 border border-slate-400 bg-[#4588ed] px-3 py-2 text-center font-serif whitespace-nowrap">
                                退税?
                            </th>
                            <th className="sticky top-0 z-20 border border-slate-400 bg-[#4588ed] px-3 py-2 text-center font-serif whitespace-nowrap">
                                备注
                                <br />
                                Remarks
                            </th>
                            <th className="sticky top-0 z-20 border border-slate-400 bg-[#4588ed] px-3 py-2 text-center font-serif whitespace-nowrap">
                                发样品空运
                                <br />
                                Samples to send by air
                            </th>
                        </tr>
                    </thead>

                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={18}
                                    className="border border-slate-300 px-4 py-6 bg-white text-center text-sm text-slate-500"
                                >
                                    No supplier rows found.
                                </td>
                            </tr>
                        ) : (
                            rows.map((row, index) => (
                                <tr key={row.id} className="bg-[#ffffff]">
                                    <td className="border border-slate-300 px-3 py-2 text-center whitespace-nowrap">
                                        {index + 1}
                                    </td>
                                    <td className="border border-slate-300 px-3 py-2 whitespace-nowrap">
                                        {display(row.name)}
                                    </td>
                                    <td className="border border-slate-300 px-3 py-2 text-center whitespace-nowrap">
                                        {display(row.qty)}
                                    </td>
                                    <td className="border border-slate-300 px-3 py-2 whitespace-nowrap">
                                        {display(row.supplier)}
                                    </td>
                                    <td className="border border-slate-300 px-3 py-2 text-center whitespace-nowrap">
                                        {display(row.cost)}
                                    </td>
                                    <td className="border border-slate-300 px-3 py-2 text-center whitespace-nowrap">
                                        {display(row.name)}
                                    </td>
                                    <td className="border border-slate-300 px-3 py-2 text-center whitespace-nowrap">
                                        {display(row.qty)}
                                    </td>
                                    <td className="border border-slate-300 bg-[#fff9a8] px-3 py-2 text-center whitespace-nowrap">
                                        {display(row.up)}
                                    </td>
                                    <td className="border border-slate-300 px-3 py-2 text-center whitespace-nowrap">
                                        {display(row.price)}
                                    </td>
                                    <td className="border border-slate-300 bg-[#fff9a8] px-3 py-2 text-center whitespace-nowrap">
                                        {display(row.tc_sgd)}
                                    </td>
                                    <td className="border border-slate-300 px-3 py-2 text-center whitespace-nowrap">
                                        {display(row.price)}
                                    </td>
                                    <td className="border border-slate-300 px-3 py-2 text-center whitespace-nowrap">
                                        {display(row.up)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}