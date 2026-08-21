'use client';

import { TimelineRow } from '../../app/types';
import { EditableCell } from './editablecell';
import { Calendar } from 'lucide-react';
import { StatusBadge } from './statusbadge';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';

export type OptionEntry = { value: string; color: string };

export function parseDateUTC(value: string | null | undefined): Date | null {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateUTC(date: Date): string {
    return date.toISOString().slice(0, 10);
}

export function diffDaysUTC(start: Date, end: Date): number {
    return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}


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
    onUpdateOptionColor,
    onRenameOption,
    readOnly = false,
}: {
    rows: TimelineRow[];
    onUpdate: (rows: TimelineRow[]) => void;
    timelineProgressOptions: OptionEntry[];
    onAddTimelineProgress?: (name: string) => void | Promise<void>;
    onDeleteTimelineProgress?: (name: string) => void | Promise<void>;
    onUpdateOptionColor?: (name: string, color: string) => void | Promise<void>;
    onRenameOption?: (oldName: string, newName: string) => void | Promise<void>;
    readOnly?: boolean;
}) {
    const [permissionNotice, setPermissionNotice] = useState<{ left: number; top: number } | null>(null);
    useEffect(() => {
        if (readOnly) return;

        const markOverdueRows = () => {
            const today = formatDateUTC(new Date());
            const nextRows = rows.map((row) => {
                const progress = (row.subProgress ?? '').trim().toLowerCase();
                const isComplete = progress === 'done' || progress === 'delivered' || progress === 'shipped out';
                const isPastEndDate = Boolean(row.timelineEnd && row.timelineEnd < today);
                return isPastEndDate && !isComplete && progress !== 'late' ? { ...row, subProgress: 'Late' } : row;
            });
            const lateCount = nextRows.filter((row, index) => row !== rows[index]).length;
            if (lateCount > 0) {
                onUpdate(nextRows);
                toast.warning('Timeline progress updated', {
                    description: `${lateCount} process${lateCount === 1 ? '' : 'es'} automatically marked Late because its end date has passed.`,
                });
            }
        };

        markOverdueRows();
        const interval = window.setInterval(markOverdueRows, 60_000);
        return () => window.clearInterval(interval);
    }, [onUpdate, readOnly, rows]);

    const updateRow = (id: string, field: keyof TimelineRow, val: string) => {
        const nextRows = rows.map((r) => (r.id === id ? { ...r, [field]: val } : r));
        const target = nextRows.find((r) => r.id === id);

        if (target) {
            const start = parseDateUTC(target.timelineStart);
            const end = parseDateUTC(target.timelineEnd);

            if (field === 'duration') {
                const durationDays = Number(val);
                if (val.trim() !== '' && Number.isFinite(durationDays)) {
                    if (durationDays < 0) {
                        toast.warning('Negative duration entered', { description: `${target.name} duration of ${durationDays} days is negative — dates were not automatically updated. Please check the entered value.` });
                    } else if (start) {
                        const computedEnd = new Date(start);
                        computedEnd.setUTCDate(computedEnd.getUTCDate() + durationDays);
                        const nextEnd = formatDateUTC(computedEnd);
                        if (nextEnd !== target.timelineEnd) {
                            target.timelineEnd = nextEnd;
                            toast.success('Timeline end date updated', { description: `${target.name} end date automatically set to ${nextEnd} based on the ${durationDays}-day duration.` });
                        }
                    } else if (end) {
                        const computedStart = new Date(end);
                        computedStart.setUTCDate(computedStart.getUTCDate() - durationDays);
                        const nextStart = formatDateUTC(computedStart);
                        if (nextStart !== target.timelineStart) {
                            target.timelineStart = nextStart;
                            toast.success('Timeline start date updated', { description: `${target.name} start date automatically set to ${nextStart} based on the ${durationDays}-day duration.` });
                        }
                    }
                }
            } else if (field === 'timelineStart' || field === 'timelineEnd') {
                if (field === 'timelineEnd' && end && !start && !target.duration) {
                    const today = formatDateUTC(new Date());
                    target.timelineStart = today;
                    toast.success('Timeline start date set', { description: `${target.name} start date automatically set to today because no start date or duration was provided.` });
                }

                const resolvedStart = parseDateUTC(target.timelineStart);
                const resolvedEnd = parseDateUTC(target.timelineEnd);
                if (resolvedStart && resolvedEnd) {
                    const durationDays = diffDaysUTC(resolvedStart, resolvedEnd);
                    const nextDuration = String(durationDays);
                    if (nextDuration !== (target.duration || '')) {
                        target.duration = nextDuration;
                        if (durationDays < 0) {
                            toast.warning('Negative duration calculated', { description: `${target.name} end date is before its start date, giving a duration of ${durationDays} days. Please check these dates.` });
                        } else {
                            toast.success('Duration updated', { description: `${target.name} duration automatically calculated as ${durationDays} day${durationDays === 1 ? '' : 's'}.` });
                        }
                    }
                } else if (target.duration) {
                    const durationDays = Number(target.duration);
                    if (Number.isFinite(durationDays) && durationDays >= 0) {
                        if (field === 'timelineStart' && resolvedStart && !resolvedEnd) {
                            const computedEnd = new Date(resolvedStart);
                            computedEnd.setUTCDate(computedEnd.getUTCDate() + durationDays);
                            target.timelineEnd = formatDateUTC(computedEnd);
                            toast.success('Timeline end date updated', { description: `${target.name} end date automatically set based on the ${durationDays}-day duration.` });
                        } else if (field === 'timelineEnd' && resolvedEnd && !resolvedStart) {
                            const computedStart = new Date(resolvedEnd);
                            computedStart.setUTCDate(computedStart.getUTCDate() - durationDays);
                            target.timelineStart = formatDateUTC(computedStart);
                            toast.success('Timeline start date updated', { description: `${target.name} start date automatically set based on the ${durationDays}-day duration.` });
                        }
                    }
                }
            }
        }

        onUpdate(nextRows);
    };

    return (
        <div onClickCapture={(event) => { if (!readOnly) return; event.preventDefault(); event.stopPropagation(); const rect = (event.target as HTMLElement).getBoundingClientRect(); setPermissionNotice({ left: Math.min(rect.left, window.innerWidth - 300), top: Math.min(rect.bottom + 8, window.innerHeight - 48) }); window.setTimeout(() => setPermissionNotice(null), 2600); }} title={readOnly ? 'You can only edit items that are assigned to you' : undefined} className="ml-8 mr-2 mb-2 w-fit max-w-[1500px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            {permissionNotice && <div role="alert" className="fixed z-[10000] rounded-md bg-slate-800 px-3 py-2 text-xs font-medium text-white shadow-xl" style={permissionNotice}>You can only edit items that are assigned to you</div>}
            <div className="flex items-center gap-2 bg-gradient-to-r from-[#9bd9e0] to-[#7BCBD5] px-3 py-1.5">
                <Calendar size={12} className="text-white" />
                <span className="text-xs font-semibold text-white">Project Timeline</span>
            </div>

            <div className="max-w-full overflow-x-auto">
                <table className="table-fixed border-collapse" style={{ minWidth: 200, maxWidth: 500 }}>
                    <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                            {[
                                { label: 'Process', w: 300 },
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
                                    className="whitespace-nowrap border-r border-gray-100 px-2 text-left text-xs font-semibold text-gray-500 last:border-r-0"
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

                                    <td className="overflow-hidden whitespace-nowrap text-ellipsis !text-center border-r border-[#D0D4E4] p-0 h-[33.1px] flex-shrink-0 transition transform active:scale-95 duration-150">
                                        <StatusBadge
                                            value={row.subProgress || 'Pending'}
                                            onChange={(v) => updateRow(row.id, 'subProgress', v)}
                                            options={timelineProgressOptions}
                                            onAddOption={onAddTimelineProgress}
                                            onDeleteOption={onDeleteTimelineProgress}
                                            manageLabel="timeline progress"
                                            onUpdateOptionColor={onUpdateOptionColor}
                                            onRenameOption={onRenameOption}
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
                                        <select
                                            value={row.dependency || ''}
                                            onChange={(event) => updateRow(row.id, 'dependency', event.target.value)}
                                            className="w-full rounded border border-gray-200 bg-white px-1 py-1 text-xs outline-none focus:border-[#7BCBD5]"
                                        >
                                            <option value="">-</option>
                                            {rows.filter((candidate) => candidate.id !== row.id).map((candidate) => (
                                                <option key={candidate.id} value={candidate.name}>{candidate.name}</option>
                                            ))}
                                        </select>
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
