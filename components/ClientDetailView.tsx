"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, FileText, MoreHorizontal, Paperclip, Send, Trash2, X } from "lucide-react";
import type { ActivityEntry, Client, Profile } from "@/app/types";
import { AssigneeMultiSelect, gradientForId } from "./ui/assignee-multiselect";
import { StatusBadge, type BadgeOption } from "./ui/statusbadge";
import { EditableCell } from "./ui/editablecell";

type Attachment = { id: string; name: string; url: string; kind?: string; actorName?: string; createdAt?: string; createdThrough?: string };
type Tab = "overview" | "files" | "activity" | "updates";
type ClientUpdate = { id: string; client_id: string; author_id: string; content: string; mentions: string[]; created_at: string; author: Profile | null };

function attachments(raw: string | undefined, field: string): Attachment[] {
  try {
    const value = JSON.parse(raw ?? "[]");
    if (Array.isArray(value)) return value.filter((item) => item?.url);
  } catch {}
  return raw ? [{ id: `${field}-legacy`, name: raw, url: raw }] : [];
}

function formatDate(value: string | undefined) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("en-GB");
}

function dateInputValue(value: string | undefined) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString().slice(0, 10);
}

export function ClientDetailView({ client, clients, profiles, assigneeIds, pmIds, canEdit, currentUserId, currentUserRole, onClose, onNavigate, onUpdate, onChangeAssignees, onUndo, statusOptions, replyStatusOptions, channelOptions, importanceOptions, groupNamesById }: {
  client: Client; clients: Client[]; profiles: Profile[]; assigneeIds: string[]; pmIds: string[]; canEdit: boolean;
  currentUserId?: string | null; currentUserRole?: string | null;
  onClose: () => void; onNavigate: (client: Client) => void; onUpdate: (updates: Partial<Client>) => void; onChangeAssignees: (ids: string[]) => void;
  onUndo: (entry: ActivityEntry) => void | Promise<void>;
  statusOptions: BadgeOption[]; replyStatusOptions: BadgeOption[]; channelOptions: BadgeOption[]; importanceOptions: BadgeOption[];
  groupNamesById: Record<string, string>;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [hoverName, setHoverName] = useState(false);
  const [permissionNotice, setPermissionNotice] = useState<{ x: number; y: number } | null>(null);
  const [updates, setUpdates] = useState<ClientUpdate[]>([]);
  const [updatesLoading, setUpdatesLoading] = useState(false);
  const [updateDraft, setUpdateDraft] = useState("");
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [isPostingUpdate, setIsPostingUpdate] = useState(false);
  const index = clients.findIndex((item) => item.id === client.id);
  const people = useMemo(() => [...new Set([...assigneeIds, ...pmIds])].map((id) => profiles.find((profile) => profile.id === id)).filter(Boolean) as Profile[], [assigneeIds, pmIds, profiles]);
  const pmProfiles = profiles.filter((profile) => profile.role?.toLowerCase() === "pm");
  const textFields: Array<[string, keyof Client]> = [["Company", "company"], ["Email", "email"], ["Phone", "phone"], ["Requirements", "requirements"], ["Company address", "companyAddress"], ["Billing address", "billingAddress"]];
  const dateFields: Array<[string, "followUp" | "nbd"]> = [["Follow up", "followUp"], ["NBD", "nbd"]];
  const fileGroups = [["Logo / requirements", "logoRequirementsFile"], ["Miscellaneous files", "filesMiscellaneous"]] as const;
  const saveFiles = (field: string, next: Attachment[]) => onUpdate({ customFields: { ...(client.customFields ?? {}), [field]: JSON.stringify(next) } });
  const ocfItems: Attachment[] = (client.activityLog ?? []).filter((entry) => entry.action === "ocf_created" && entry.link).map((entry) => ({ id: entry.id, name: entry.title || "Order confirmation", url: entry.link!, actorName: entry.actorName, createdAt: entry.createdAt }));
  const displayValue = (field: string | undefined, value: unknown) => field === "groupId" && typeof value === "string" ? groupNamesById[value] ?? "Ungrouped" : String(value ?? "empty");
  const activityText = (entry: ActivityEntry) => entry.title || (entry.fieldName ? `changed ${entry.fieldName} from ${displayValue(entry.fieldName, entry.oldValue)} to ${displayValue(entry.fieldName, entry.newValue)}` : entry.action.replaceAll("_", " "));
  const clientActivities = (client.activityLog ?? [])
    .filter((entry) => !entry.subitemId || entry.action === "subitem_added" || entry.action === "subitem_deleted")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const showPermissionNotice = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setPermissionNotice({ x: Math.min(rect.left, window.innerWidth - 290), y: Math.min(rect.bottom + 8, window.innerHeight - 54) });
  };
  const blockIfLocked = (event: React.MouseEvent<HTMLElement>) => {
    if (canEdit) return;
    event.preventDefault();
    event.stopPropagation();
    showPermissionNotice(event.currentTarget);
  };
  const mentionQuery = updateDraft.match(/(?:^|\s)@([^@\s]*)$/)?.[1]?.toLowerCase() ?? null;
  const mentionCandidates = mentionQuery === null ? [] : profiles.filter((profile) => profile.id !== currentUserId && profile.role?.toLowerCase() !== "shipper" && `${profile.full_name ?? ""} ${profile.email ?? ""}`.toLowerCase().includes(mentionQuery)).slice(0, 6);
  const loadUpdates = async () => {
    setUpdatesLoading(true);
    try {
      const response = await fetch(`/api/client-updates?clientId=${encodeURIComponent(client.id)}`);
      if (!response.ok) throw new Error("Unable to load updates");
      setUpdates(await response.json() as ClientUpdate[]);
    } catch {
      setUpdates([]);
    } finally {
      setUpdatesLoading(false);
    }
  };
  useEffect(() => { if (tab === "updates") void loadUpdates(); }, [tab, client.id]);
  const selectMention = (profile: Profile) => {
    const name = profile.full_name || profile.email || "User";
    setUpdateDraft((value) => value.replace(/(?:^|\s)@([^@\s]*)$/, (match) => `${match.startsWith(" ") ? " " : ""}@${name} `));
    setMentionIds((ids) => ids.includes(profile.id) ? ids : [...ids, profile.id]);
  };
  const postUpdate = async () => {
    if (!updateDraft.trim() || isPostingUpdate) return;
    setIsPostingUpdate(true);
    try {
      const response = await fetch("/api/client-updates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId: client.id, content: updateDraft, mentionIds }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Unable to post update");
      setUpdates((items) => [...items, result as ClientUpdate]);
      setUpdateDraft(""); setMentionIds([]);
    } finally { setIsPostingUpdate(false); }
  };
  const deleteUpdate = async (id: string) => {
    const response = await fetch(`/api/client-updates?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (response.ok) setUpdates((items) => items.filter((item) => item.id !== id));
  };

  return <div className="fixed inset-0 z-[200] bg-slate-950/40 p-3 sm:p-6">
    <section className="flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <header className="flex items-center gap-4 border-b border-slate-200 px-6 py-4">
        <div onMouseEnter={() => setHoverName(true)} onMouseLeave={() => setHoverName(false)} onClick={blockIfLocked} className="min-w-0 flex-1">
          <input value={client.name} readOnly={!canEdit} onChange={(event) => onUpdate({ name: event.target.value })} className={`w-full rounded border px-2 py-1 text-2xl font-semibold outline-none transition ${hoverName && canEdit ? "border-sky-400 bg-white" : "border-transparent bg-transparent"} ${!canEdit ? "cursor-default" : ""}`} />
        </div>
        <div className="flex -space-x-2">{people.map((profile) => <span key={profile.id} title={profile.full_name || profile.email || "User"} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white" style={{ background: gradientForId(profile.id) }}>{(profile.full_name || profile.email || "U").slice(0, 2).toUpperCase()}</span>)}</div>
        <button onClick={() => index > 0 && onNavigate(clients[index - 1])} disabled={index <= 0} className="rounded border p-2 disabled:opacity-30" title="Previous client"><ChevronLeft size={17} /></button>
        <button onClick={() => index < clients.length - 1 && onNavigate(clients[index + 1])} disabled={index >= clients.length - 1} className="rounded border p-2 disabled:opacity-30" title="Next client"><ChevronRight size={17} /></button>
        <button className="rounded border p-2" title="More actions"><MoreHorizontal size={17} /></button><button onClick={onClose} className="rounded border p-2" title="Close"><X size={17} /></button>
      </header>
      <nav className="flex gap-6 border-b border-slate-200 px-6">{([['overview', 'Overview'], ['updates', 'Updates'], ['files', 'Files'], ['activity', 'Activity Log']] as const).map(([key, label]) => <button key={key} onClick={() => setTab(key)} className={`border-b-2 py-3 text-sm ${tab === key ? "border-sky-500 text-sky-600" : "border-transparent text-slate-500"}`}>{label}</button>)}</nav>
      {tab === "overview" && <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-auto bg-slate-50 p-4 lg:grid-cols-[1fr_720px]"><div className="flex min-h-80 items-center justify-center rounded-xl border border-slate-200 bg-white text-center text-slate-400"><div><h2 className="mb-2 text-lg font-medium text-slate-600">Emails &amp; Activities</h2><p>Activity timeline placeholder</p></div></div><aside className="rounded-xl border border-slate-200 bg-white p-7"><h2 className="mb-6 text-lg font-semibold text-slate-800">Client details</h2><div className="grid grid-cols-2 gap-x-4 gap-y-5">
        <DetailStatus label="Reply status" value={client.replyStatus} options={replyStatusOptions} locked={!canEdit} onLockedClick={showPermissionNotice} onChange={(replyStatus) => onUpdate({ replyStatus })} />
        <DetailStatus label="Status" value={client.status} options={statusOptions} locked={!canEdit} onLockedClick={showPermissionNotice} onChange={(status) => onUpdate({ status: status as Client["status"] })} />
        <DetailStatus label="Channel" value={client.channel} options={channelOptions} locked={!canEdit} onLockedClick={showPermissionNotice} onChange={(channel) => onUpdate({ channel })} />
        <DetailStatus label="Importance" value={client.importance} options={importanceOptions} locked={!canEdit} onLockedClick={showPermissionNotice} onChange={(importance) => onUpdate({ importance })} />
        <div data-assignment-editor><label className="mb-2 block text-sm font-medium text-slate-500">People</label><div className="min-h-10"><AssigneeMultiSelect profiles={profiles} selectedIds={assigneeIds} onChange={onChangeAssignees} /></div></div>
        <div data-assignment-editor><label className="mb-2 block text-sm font-medium text-slate-500">PM</label><div className="min-h-10"><AssigneeMultiSelect profiles={pmProfiles} selectedIds={pmIds} onChange={(ids) => onUpdate({ customFields: { ...(client.customFields ?? {}), pmAssigneeIds: JSON.stringify(ids) } })} /></div></div>
        {textFields.map(([label, key]) => <label key={key} className="text-sm font-medium text-slate-500">{label}<div onClickCapture={blockIfLocked} className="mt-2 min-h-10 rounded border border-slate-200 bg-white"><EditableCell className="min-h-[38px] px-2 text-sm" readOnly={!canEdit} value={String(client[key] ?? "")} onChange={(value) => onUpdate({ [key]: value } as Partial<Client>)} /></div></label>)}
        {dateFields.map(([label, key]) => <label key={key} className="text-sm font-medium text-slate-500">{label}<div onClickCapture={blockIfLocked} className="mt-2 flex min-h-10 items-center rounded border border-slate-200 bg-white px-3">{canEdit ? <input type="date" value={dateInputValue(client[key])} onChange={(event) => onUpdate({ [key]: event.target.value || undefined } as Partial<Client>)} className="w-full bg-transparent text-sm text-slate-700 outline-none" /> : <span className="text-sm text-slate-700">{formatDate(client[key])}</span>}</div></label>)}
      </div></aside></main>}
      {tab === "files" && <main className="min-h-0 flex-1 overflow-auto bg-slate-50 p-6">{[["OCF files", "ocfFiles", ocfItems] as const, ...fileGroups.map(([label, field]) => [label, field, attachments(client.customFields?.[field], field)] as const)].map(([label, field, items]) => <section key={field} className="mb-5 rounded-xl border border-slate-200 bg-white p-5"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold text-slate-800">{label}</h2>{canEdit && field !== "ocfFiles" && <label className="cursor-pointer rounded border px-3 py-1.5 text-xs text-sky-700"><Paperclip size={13} className="mr-1 inline" />Add file<input type="file" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => saveFiles(field, [...items, { id: crypto.randomUUID(), name: file.name, url: String(reader.result), kind: "file" }]); reader.readAsDataURL(file); }} /></label>}</div>{items.length ? <div className="space-y-2">{items.map((item) => <div key={item.id} className="flex items-center gap-2 rounded border p-2"><FileText size={16} className="text-sky-600" /><div className="min-w-0 flex-1"><a href={item.url} target="_blank" rel="noreferrer" className="block truncate text-sm text-sky-700 hover:underline">{item.name}</a>{item.createdAt && <p className="text-xs text-slate-400">{item.createdThrough ? `${item.createdThrough} · ` : ""}{item.actorName} - {new Date(item.createdAt).toLocaleString()}</p>}</div>{canEdit && field !== "ocfFiles" && <button onClick={() => saveFiles(field, items.filter((entry) => entry.id !== item.id))} className="text-xs text-red-500">Remove</button>}</div>)}</div> : <p className="text-sm text-slate-400">No files attached.</p>}</section>)}</main>}
      {tab === "updates" && <main className="min-h-0 flex-1 overflow-auto bg-slate-50 p-6"><div className="mx-auto max-w-3xl"><div className="relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><textarea value={updateDraft} onChange={(event) => setUpdateDraft(event.target.value)} placeholder="Write an update… Type @ to tag a teammate." rows={3} className="w-full resize-none border-0 text-sm text-slate-800 outline-none" />{mentionCandidates.length > 0 && <div className="absolute left-4 top-full z-10 mt-1 w-72 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl">{mentionCandidates.map((profile) => <button type="button" key={profile.id} onClick={() => selectMention(profile)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"><span className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white" style={{ background: gradientForId(profile.id) }}>{(profile.full_name || profile.email || "U").slice(0, 2).toUpperCase()}</span>{profile.full_name || profile.email}</button>)}</div>}<div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3"><span className="text-xs text-slate-400">Tagged users receive a notification.</span><button type="button" onClick={() => void postUpdate()} disabled={!updateDraft.trim() || isPostingUpdate} className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"><Send size={14} />{isPostingUpdate ? "Posting…" : "Post update"}</button></div></div><div className="mt-5 space-y-3">{updatesLoading ? <p className="text-center text-sm text-slate-400">Loading updates…</p> : updates.map((update) => { const author = update.author; const canDelete = update.author_id === currentUserId || ["director", "dev"].includes(currentUserRole ?? ""); return <article key={update.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ background: gradientForId(update.author_id) }}>{(author?.full_name || author?.email || "U").slice(0, 2).toUpperCase()}</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-slate-800">{author?.full_name || author?.email || "Unknown user"}</p><p className="text-xs text-slate-400">{new Date(update.created_at).toLocaleString()}</p></div>{canDelete && <button type="button" onClick={() => void deleteUpdate(update.id)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500" title="Delete update"><Trash2 size={15} /></button>}</div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{update.content}</p></div></div></article>; })}{!updatesLoading && !updates.length && <p className="py-10 text-center text-sm text-slate-400">No updates yet. Start the conversation.</p>}</div></div></main>}
      {tab === "activity" && <main className="min-h-0 flex-1 overflow-auto bg-slate-50 p-6"><div className="mx-auto max-w-4xl space-y-3">{clientActivities.map((entry) => <article key={entry.id} className="rounded-lg border border-slate-100 bg-white px-3 py-2"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm text-slate-800"><span className="font-medium">{entry.actorName}</span> {activityText(entry)}{entry.link && <a href={entry.link} target="_blank" rel="noreferrer" className="ml-4 inline-flex items-center rounded-md bg-teal-100 px-2 py-1 text-[12.6px] font-medium text-teal-600 hover:bg-teal-200">Open OCF</a>}</p><p className="mt-1 text-[12.6px] text-slate-500">{new Date(entry.createdAt).toLocaleString()}</p></div>{(entry.action === "field_changed" || entry.action === "subitem_field_changed") && entry.oldValue != null && <button type="button" disabled={!canEdit} onClick={() => void onUndo(entry)} title={!canEdit ? "You can only edit items that are assigned to you" : "Undo this action"} className="shrink-0 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50">Undo</button>}</div></article>)}{!clientActivities.length && <p className="text-center text-sm text-slate-400">No activity recorded yet.</p>}</div></main>}
    </section>
    {permissionNotice && <button type="button" onClick={() => setPermissionNotice(null)} className="fixed z-[210] rounded bg-slate-800 px-3 py-2 text-xs text-white shadow-lg" style={{ left: permissionNotice.x, top: permissionNotice.y }}>You can only edit items that are assigned to you</button>}
  </div>;
}

function DetailStatus({ label, value, options, onChange, locked, onLockedClick }: { label: string; value: string; options: BadgeOption[]; onChange: (value: string) => void; locked: boolean; onLockedClick: (element: HTMLElement) => void }) {
  return <div><label className="mb-2 block text-sm font-medium text-slate-500">{label}</label><div onClickCapture={(event) => { if (!locked) return; event.preventDefault(); event.stopPropagation(); onLockedClick(event.currentTarget); }} className={`h-10 overflow-hidden rounded ${locked ? "cursor-default opacity-70" : ""}`}><div className={`h-full ${locked ? "pointer-events-none" : ""}`}><StatusBadge value={value} onChange={onChange} options={options} /></div></div></div>;
}
