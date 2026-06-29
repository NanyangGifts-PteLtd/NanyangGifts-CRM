'use client';

import { useEffect, useState } from 'react';
import {
    getSalesRoundRobinQueue,
    setSalesRoundRobinActive,
    swapSalesRoundRobinFunctions,
    type RoundRobinQueueRow,
} from '@/lib/crm';

export function RoundRobinAdminPanel() {
    const [rows, setRows] = useState<RoundRobinQueueRow[]>([]);
    const [loading, setLoading] = useState(true);

    async function load() {
        setLoading(true);
        try {
            const data = await getSalesRoundRobinQueue();
            setRows(data);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load();
    }, []);

    async function moveUp(index: number) {
        if (index <= 0) return;
        const current = rows[index];
        const previous = rows[index - 1];
        await swapSalesRoundRobinFunctions(current.user_id, previous.user_id);
        await load();
    }

    async function moveDown(index: number) {
        if (index >= rows.length - 1) return;
        const current = rows[index];
        const next = rows[index + 1];
        await swapSalesRoundRobinFunctions(current.user_id, next.user_id);
        await load();
    }

    async function toggleActive(row: RoundRobinQueueRow) {
        await setSalesRoundRobinActive(row.user_id, !row.is_active);
        await load();
    }

    if (loading) {
        return <div className="text-sm text-gray-500">Loading round robin queue...</div>;
    }

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-4">
                <h2 className="text-sm font-semibold text-gray-900">Sales round robin</h2>
                <p className="text-xs text-gray-500">
                    Current order and assignment pool.
                </p>
            </div>

            <div className="space-y-2">
                {rows.map((row, index) => (
                    <div
                        key={row.user_id}
                        className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2"
                    >
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-800">
                                    {row.full_name || row.email || 'Unknown user'}
                                </span>
                                {row.is_current && (
                                    <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-semibold text-cyan-700">
                                        Current pointer
                                    </span>
                                )}
                                {!row.is_active && (
                                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                                        Inactive
                                    </span>
                                )}
                            </div>

                            <p className="text-xs text-gray-500">
                                Position {row.position} · {row.email}
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => void moveUp(index)}
                                className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                            >
                                Up
                            </button>

                            <button
                                type="button"
                                onClick={() => void moveDown(index)}
                                className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                            >
                                Down
                            </button>

                            <button
                                type="button"
                                onClick={() => void toggleActive(row)}
                                className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                            >
                                {row.is_active ? 'Remove from pool' : 'Add back'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}