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
                <table className="min-w-[1800px] border-collapse text-[12px] text-white">
                    <thead>
                        <tr>
                            <th className="sticky top-0 z-20 border border-slate-400 bg-[#4588ed] px-3 py-2 text-center font-semibold whitespace-nowrap">
                                I/C
                            </th>
                            <th className="sticky top-0 z-20 border border-slate-400 bg-[#4588ed] px-3 py-2 text-center font-semibold whitespace-nowrap">
                                Name
                            </th>
                            <th className="sticky top-0 z-20 border border-slate-400 bg-[#4588ed] px-3 py-2 text-center font-semibold whitespace-nowrap">
                                Tracking ID
                            </th>
                            <th className="sticky top-0 z-20 border border-slate-400 bg-[#4588ed] px-3 py-2 text-center font-semibold whitespace-nowrap">
                                Cartons
                            </th>
                            <th className="sticky top-0 z-20 border border-slate-400 bg-[#4588ed] px-3 py-2 text-center font-semibold whitespace-nowrap">
                                Item name
                            </th>
                            <th className="sticky top-0 z-20 border border-slate-400 bg-[#4588ed] px-3 py-2 text-center font-semibold whitespace-nowrap">
                                Address
                            </th>
                            <th className="sticky top-0 z-20 border border-slate-400 bg-[#4588ed] px-3 py-2 text-center font-semibold whitespace-nowrap">
                                Qty
                            </th>
                            <th className="sticky top-0 z-20 border border-slate-400 bg-[#4588ed] px-3 py-2 text-center font-semibold whitespace-nowrap">
                                Unit Price
                            </th>
                            <th className="sticky top-0 z-20 border border-slate-400 bg-[#4588ed] px-3 py-2 text-center font-semibold whitespace-nowrap">
                                Value
                            </th>
                            <th className="sticky top-0 z-20 border border-slate-400 bg-[#4588ed] px-3 py-2 text-center font-semibold whitespace-nowrap">
                                Sea or Air?
                            </th>
                            <th className="sticky top-0 z-20 border border-slate-400 bg-[#4588ed] px-3 py-2 text-center font-semibold whitespace-nowrap">
                                Total Cost SGD
                            </th>
                            <th className="sticky top-0 z-20 border border-slate-400 bg-[#4588ed] px-3 py-2 text-center font-semibold whitespace-nowrap">
                                Remarks
                            </th>
                            <th className="sticky top-0 z-20 border border-slate-400 bg-[#4588ed] px-3 py-2 text-center font-semibold whitespace-nowrap">
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
                                        {display(row.ls)}
                                    </td>
                                    <td className="border border-slate-300 px-3 py-2 text-center whitespace-nowrap">
                                        {display(row.os)}
                                    </td>
                                    <td className="border border-slate-300 bg-[#fff9a8] px-3 py-2 text-center whitespace-nowrap">
                                        {display(row.tc)}
                                    </td>
                                    <td className="border border-slate-300 px-3 py-2 text-center whitespace-nowrap">
                                        {display(row.uc)}
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