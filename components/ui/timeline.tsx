'use client';

import { TimelineRow } from '../../app/types';
import { EditableCell } from './editablecell';
import { Calendar } from 'lucide-react';
import { StatusBadge } from './statusbadge';

export type OptionEntry = { value: string; color: string };


export const DEFAULT_TIMELINE_ROWS = [
    {
        id: 'sample',
        name: 'Sample',
        person: '',
        remarks: '',
        numOfCartons: '',
        subProgress: 'Pending',
        timelineStart: '',
        timelineEnd: '',
        duration: '',
        dependency: '',
    },
    {
        id: 'production',
        name: 'Production 📦',
        person: '',
        remarks: '',
        numOfCartons: '',
        subProgress: 'Pending',
        timelineStart: '',
        timelineEnd: '',
        duration: '',
        dependency: 'Sample',
    },
    {
        id: 'productionstatus',
        name: 'Check Production Status (+3 from production start)',
        person: '',
        remarks: '',
        numOfCartons: '',
        subProgress: 'Pending',
        timelineStart: '',
        timelineEnd: '',
        duration: '',
        dependency: '',
    },
    {
        id: 'localshipping',
        name: 'Local Shipping 🚚',
        person: '',
        remarks: '',
        numOfCartons: '',
        subProgress: 'Pending',
        timelineStart: '',
        timelineEnd: '',
        duration: '',
        dependency: 'Production 📦',
    },
    {
        id: 'seaairfreight',
        name: 'Sea/Air Freight ⛵✈️',
        person: '',
        remarks: '',
        numOfCartons: '',
        subProgress: 'Pending',
        timelineStart: '',
        timelineEnd: '',
        duration: '',
        dependency: 'Local Shipping 🚚',
    },
    {
        id: 'shipmentstatus',
        name: 'Check Shipment Status (+3 from shipment start)',
        person: '',
        remarks: '',
        numOfCartons: '',
        subProgress: 'Pending',
        timelineStart: '',
        timelineEnd: '',
        duration: '',
        dependency: '',
    },
    {
        id: 'nbd',
        name: 'NBD',
        person: '',
        remarks: '',
        numOfCartons: '',
        subProgress: 'Pending',
        timelineStart: '',
        timelineEnd: '',
        duration: '',
        dependency: '',
    },
];

export function TimelineSection({
    rows,
    onUpdate,
    timelineProgressOptions,
    onAddTimelineProgress,
    onDeleteTimelineProgress,
}: {
    rows: TimelineRow[];
    onUpdate: (rows: TimelineRow[]) => void;
    timelineProgressOptions: OptionEntry[];
    onAddTimelineProgress?: (name: string) => void | Promise<void>;
    onDeleteTimelineProgress?: (name: string) => void | Promise<void>;
}) {
    const updateRow = (id: string, field: keyof TimelineRow, val: string) =>
        onUpdate(rows.map((r) => (r.id === id ? { ...r, [field]: val } : r)));

    return (
        <div className="ml-8 mr-2 mb-2 w-fit max-w-[1500px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 bg-gradient-to-r from-[#9bd9e0] to-[#7BCBD5] px-3 py-1.5">
                <Calendar size={12} className="text-white" />
                <span className="text-xs font-semibold text-white">Project Timeline</span>
            </div>

            <div className="max-w-full overflow-x-auto">
                <table className="table-fixed border-collapse" style={{ minWidth: 200, maxWidth: 500 }}>
                    <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                            {[
                                { label: 'Subitem', w: 300 },
                                { label: 'Person', w: 30 },
                                { label: 'Remarks', w: 200 },
                                { label: 'No. of Cartons', w: 30 },
                                { label: 'Sub-Progress', w: 100 },
                                { label: 'Timeline', w: 100 },
                                { label: 'Duration', w: 70 },
                                { label: 'Dependency', w: 100 },
                            ].map((col) => (
                                <th
                                    key={col.label}
                                    style={{ minWidth: col.w }}
                                    className="whitespace-nowrap border-r border-gray-100 px-2 py-1 text-left text-xs font-semibold text-gray-500 last:border-r-0"
                                >
                                    {col.label}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                        {rows.map((row) => {
                                const textColor =
                                row.subProgress === 'Done' || row.subProgress === 'Started' ? '#fff' : '#333';

                            return (
                                <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                                    <td className="border-r border-gray-100 px-2 py-1">
                                        <span className="text-xs text-gray-700">{row.name}</span>
                                    </td>

                                    <td className="border-r border-gray-100 px-2 py-1">
                                        <EditableCell value={row.person} onChange={(v) => updateRow(row.id, 'person', v)} />
                                    </td>

                                    <td className="border-r border-gray-100 px-2 py-1">
                                        <EditableCell value={row.remarks} onChange={(v) => updateRow(row.id, 'remarks', v)} />
                                    </td>

                                    <td className="border-r border-gray-100 px-2 py-1">
                                        <EditableCell
                                            value={row.numOfCartons ?? ''}
                                            onChange={(v) => updateRow(row.id, 'numOfCartons', v)}
                                            type="number"
                                        />
                                    </td>

                                    <td className="border-r border-gray-100 px-2 py-1">
                                        <StatusBadge
                                            value={row.subProgress || 'Pending'}
                                            onChange={(v) => updateRow(row.id, 'subProgress', v)}
                                            options={timelineProgressOptions}
                                            onAddOption={onAddTimelineProgress}
                                            onDeleteOption={onDeleteTimelineProgress}
                                            manageLabel="timeline progress"
                                            small
                                        />
                                    </td>

                                    <td className="border-r border-gray-100 px-2 py-1">
                                        <div className="flex gap-1">
                                            <input
                                                type="date"
                                                value={row.timelineStart || ''}
                                                onChange={(e) => updateRow(row.id, 'timelineStart', e.target.value)}
                                                className="w-32 cursor-pointer rounded border border-gray-200 bg-white px-1 py-1 text-xs"
                                            />
                                            <input
                                                type="date"
                                                value={row.timelineEnd || ''}
                                                onChange={(e) => updateRow(row.id, 'timelineEnd', e.target.value)}
                                                className="w-32 cursor-pointer rounded border border-gray-200 bg-white px-1 py-1 text-xs"
                                            />
                                        </div>
                                    </td>

                                    <td className="border-r border-gray-100 px-2 py-1">
                                        <EditableCell value={row.duration} onChange={(v) => updateRow(row.id, 'duration', v)} />
                                    </td>

                                    <td className="border-r border-gray-100 px-2 py-1">
                                        <EditableCell value={row.dependency} onChange={(v) => updateRow(row.id, 'dependency', v)} />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}