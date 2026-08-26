"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, Building2, Check, ChevronDown, ChevronRight, CreditCard, Factory, Landmark, LoaderCircle, MessageSquare, Phone, Plus, Search, Send, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import type { Client } from "@/app/types";

type ClientPhoneNumber = { id: string; phone_number: string; is_primary: boolean };
type ClientProfile = { id: string; phone_number: string; phone_numbers: ClientPhoneNumber[]; name: string; remarks: string | null; is_blacklisted: boolean; blacklisted_at: string | null };
type IndustryOption = { id: string; code: string; name: string; section_code: string; section_name: string };
type IndustrySelection = { option: IndustryOption | null; customText: string };
type CompanyProfile = { id: string; name: string; payment_term: string | null; industry: string | null; industry_option_id: string | null; industry_custom_text: string | null; industry_source: string | null; industry_option: IndustryOption | null; organization_type: string | null; remarks: string | null };

const inputClass = "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#16a5c4] focus:ring-2 focus:ring-[#16a5c4]/15";
const paymentTerms = ["Net 30", "Net 60", "Net 90", "Due on Receipt", "End of Month (EOM)", "Cash on Delivery (COD)", "Payment in Advance (PIA)"];

function ProfileEditField({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4"><span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{icon}{label}</span><div className="mt-2">{children}</div></div>;
}

function clientPhoneNumbers(client: ClientProfile): ClientPhoneNumber[] {
  if (client.phone_numbers?.length) return [...client.phone_numbers].sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
  return [{ id: `legacy-${client.id}`, phone_number: client.phone_number, is_primary: true }];
}

function clientProfileValidationError(client: ClientProfile, allClients: ClientProfile[] = []) {
  if (!client.name.trim()) return "Client name is required.";
  const phones = clientPhoneNumbers(client);
  const normalized = phones.map((phone) => normalizeProfilePhone(phone.phone_number));
  if (!phones.length) return "At least one phone number is required.";
  if (normalized.some((phone) => !phone)) return "Phone numbers cannot be blank.";
  if (new Set(normalized).size !== normalized.length) return "The same phone number cannot be added more than once.";
  if (phones.filter((phone) => phone.is_primary).length !== 1) return "Choose exactly one main phone number.";
  const conflictingProfile = allClients.find((other) => other.id !== client.id && clientPhoneNumbers(other).some((phone) => normalized.includes(normalizeProfilePhone(phone.phone_number))));
  if (conflictingProfile) return `One of these phone numbers already belongs to ${conflictingProfile.name}.`;
  return null;
}

function clientProfileFingerprint(client: ClientProfile) {
  const phones = clientPhoneNumbers(client)
    .map((phone) => ({ phoneNumber: phone.phone_number.trim(), isPrimary: phone.is_primary }))
    .sort((a, b) => normalizeProfilePhone(a.phoneNumber).localeCompare(normalizeProfilePhone(b.phoneNumber)));
  return JSON.stringify({ name: client.name.trim(), phones });
}

function companyProfileFingerprint(company: CompanyProfile) {
  return JSON.stringify({
    name: company.name.trim(),
    paymentTerm: company.payment_term ?? "",
    industryOptionId: company.industry_option_id ?? "",
    industryCustomText: (company.industry_custom_text ?? (company.industry_option_id ? "" : company.industry ?? "")).trim(),
    organizationType: company.organization_type ?? "",
  });
}

function ClientPhoneNumbersEditor({ client, onChange }: { client: ClientProfile; onChange: (next: ClientProfile) => void }) {
  const phones = clientPhoneNumbers(client);
  const apply = (nextPhones: ClientPhoneNumber[]) => {
    const primary = nextPhones.find((phone) => phone.is_primary) ?? nextPhones[0];
    const normalized = nextPhones.map((phone) => ({ ...phone, is_primary: phone.id === primary.id }));
    onChange({ ...client, phone_number: primary.phone_number, phone_numbers: normalized });
  };
  const remove = (id: string) => {
    if (phones.length === 1) return;
    const removed = phones.find((phone) => phone.id === id);
    const remaining = phones.filter((phone) => phone.id !== id);
    if (removed?.is_primary) remaining[0] = { ...remaining[0], is_primary: true };
    apply(remaining);
  };

  return <div className="space-y-2">
    {phones.map((phone, index) => <div key={phone.id} className="flex items-center gap-2">
      <input type="tel" value={phone.phone_number} placeholder={`Phone number ${index + 1}`} onChange={(event) => apply(phones.map((item) => item.id === phone.id ? { ...item, phone_number: event.target.value } : item))} className={inputClass} />
      <button type="button" onClick={() => apply(phones.map((item) => ({ ...item, is_primary: item.id === phone.id })))} className={`h-10 shrink-0 rounded-md border px-3 text-xs font-semibold ${phone.is_primary ? "border-cyan-200 bg-cyan-50 text-[#168da7]" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`} title={phone.is_primary ? "Main phone number" : "Set as main phone number"}>{phone.is_primary ? "Main" : "Make main"}</button>
      <button type="button" disabled={phones.length === 1} onClick={() => remove(phone.id)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-slate-200 disabled:hover:bg-transparent disabled:hover:text-slate-400" aria-label="Remove phone number"><Trash2 size={15} /></button>
    </div>)}
    <button type="button" disabled={phones.length >= 20} onClick={() => apply([...phones, { id: `new-${Date.now()}`, phone_number: "", is_primary: false }])} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-[#168da7] hover:bg-cyan-50 disabled:opacity-40"><Plus size={14} /> Add another phone number</button>
    <p className="text-[11px] text-slate-400">The main number is shown in the profile list. Leads and blacklist matching use every number.</p>
  </div>;
}

function IndustryCombobox({ value, onChange }: { value: IndustrySelection; onChange: (next: IndustrySelection) => void }) {
  const listboxId = useId();
  const displayValue = value.option ? `${value.option.code} - ${value.option.name}` : value.customText;
  const [query, setQuery] = useState(displayValue);
  const [options, setOptions] = useState<IndustryOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(displayValue); }, [displayValue]);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const selectedDisplay = value.option ? `${value.option.code} - ${value.option.name}` : "";
        const search = value.option && query === selectedDisplay ? value.option.code : query;
        const response = await fetch(`/api/industry-options?q=${encodeURIComponent(search.trim())}`, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to load SSIC industries.");
        setOptions(result.options ?? []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") toast.error(error instanceof Error ? error.message : "Unable to load SSIC industries.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [open, query, value.option]);

  const chooseOption = (option: IndustryOption) => {
    onChange({ option, customText: "" });
    setQuery(`${option.code} - ${option.name}`);
    setOpen(false);
  };
  const chooseCustom = () => {
    const customText = query.trim();
    onChange({ option: null, customText });
    setQuery(customText);
    setOpen(false);
  };

  return <div ref={rootRef} className="relative">
    <div className="relative">
      <input
        value={query}
        role="combobox"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-autocomplete="list"
        placeholder="Search SSIC code or industry, or enter a custom value"
        onFocus={() => setOpen(true)}
        onChange={(event) => { const next = event.target.value; setQuery(next); onChange({ option: null, customText: next }); setOpen(true); }}
        onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); if (event.key === "Enter" && open && query.trim()) { event.preventDefault(); chooseCustom(); } }}
        className={`${inputClass} pr-16`}
      />
      {(query || value.option) && <button type="button" onClick={() => { setQuery(""); onChange({ option: null, customText: "" }); setOpen(true); }} className="absolute right-8 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Clear industry"><X size={14} /></button>}
      <button type="button" onClick={() => setOpen((current) => !current)} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Toggle SSIC industries"><ChevronDown size={16} /></button>
    </div>
    {open && <div id={listboxId} role="listbox" className="absolute z-[80] mt-1 max-h-80 w-full min-w-[340px] overflow-y-auto rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl">
      <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">SSIC 2025 industries</div>
      {loading ? <div className="flex items-center justify-center px-3 py-6 text-sm text-slate-400"><LoaderCircle size={16} className="mr-2 animate-spin" /> Searching...</div> : options.map((option) => <button key={option.id} type="button" role="option" aria-selected={value.option?.id === option.id} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseOption(option)} className="flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left hover:bg-violet-50"><span className="mt-0.5 w-12 shrink-0 font-mono text-xs font-semibold text-violet-600">{option.code}</span><span className="min-w-0 flex-1"><span className="block text-sm text-slate-700">{option.name}</span><span className="mt-0.5 block truncate text-[11px] text-slate-400">Section {option.section_code} - {option.section_name}</span></span>{value.option?.id === option.id && <Check size={15} className="mt-0.5 shrink-0 text-violet-600" />}</button>)}
      {!loading && !options.length && <p className="px-3 py-5 text-center text-sm text-slate-400">No matching SSIC industries.</p>}
      {query.trim() && !value.option && <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={chooseCustom} className="mt-1 flex w-full items-center gap-2 border-t border-slate-100 px-2.5 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"><Plus size={15} className="text-slate-400" /> Use &quot;{query.trim()}&quot; as a custom industry</button>}
    </div>}
    <p className="mt-1.5 text-[11px] text-slate-400">Choose an official five-digit SSIC 2025 code, or keep a custom industry.</p>
  </div>;
}

function DeleteProfileDialog({ name, type, deleting, onCancel, onConfirm }: { name: string; type: "client" | "company"; deleting: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]"><div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"><div className="flex gap-3 border-b border-slate-100 p-5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600"><AlertTriangle size={20} /></span><div><h2 className="font-semibold text-slate-900">Delete {type} profile?</h2><p className="mt-1 text-sm leading-5 text-slate-500"><strong className="text-slate-700">{name}</strong> will be permanently removed from Customer Profiles.</p></div></div><div className="flex justify-end gap-2 p-4"><button type="button" disabled={deleting} onClick={onCancel} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancel</button><button type="button" disabled={deleting} onClick={onConfirm} className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">{deleting ? <LoaderCircle size={15} className="animate-spin" /> : <Trash2 size={15} />}{deleting ? "Deleting..." : "Delete profile"}</button></div></div></div>;
}

function BlacklistDialog({ name, blacklisted, saving, onCancel, onConfirm }: { name: string; blacklisted: boolean; saving: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true"><div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"><div className="flex gap-3 border-b border-slate-100 p-5"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${blacklisted ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}><AlertTriangle size={20} /></span><div><h2 className="font-semibold text-slate-900">{blacklisted ? "Remove client from blacklist?" : "Blacklist this client?"}</h2><p className="mt-1 text-sm leading-5 text-slate-500"><strong className="text-slate-700">{name}</strong> {blacklisted ? "will no longer be marked as blacklisted across matching CRM leads." : "and every CRM lead with the same phone number will be prominently marked as blacklisted."}</p></div></div><div className="flex justify-end gap-2 p-4"><button type="button" disabled={saving} onClick={onCancel} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancel</button><button type="button" disabled={saving} onClick={onConfirm} className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${blacklisted ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}>{saving && <LoaderCircle size={15} className="animate-spin" />}{saving ? "Saving..." : blacklisted ? "Remove from blacklist" : "Blacklist client"}</button></div></div></div>;
}

type ProfileRemark = { id: string; content: string; createdAt: string; authorName: string; canDelete: boolean };

function DeleteRemarkDialog({ deleting, onCancel, onConfirm }: { deleting: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="delete-remark-title"><div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"><div className="flex gap-3 border-b border-slate-100 p-5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600"><AlertTriangle size={20} /></span><div><h2 id="delete-remark-title" className="font-semibold text-slate-900">Delete this remark?</h2><p className="mt-1 text-sm leading-5 text-slate-500">This remark will be permanently removed from the profile.</p></div></div><div className="flex justify-end gap-2 p-4"><button type="button" disabled={deleting} onClick={onCancel} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancel</button><button type="button" disabled={deleting} onClick={onConfirm} className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">{deleting ? <LoaderCircle size={15} className="animate-spin" /> : <Trash2 size={15} />}{deleting ? "Deleting..." : "Delete remark"}</button></div></div></div>;
}

function ProfileRemarks({ type, profileId }: { type: "client" | "company"; profileId: string }) {
  const [remarks, setRemarks] = useState<ProfileRemark[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => { let active = true; void fetch(`/api/customer-profiles/remarks?type=${type}&profileId=${encodeURIComponent(profileId)}`).then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.error || "Unable to load remarks."); if (active) setRemarks(result.remarks ?? []); }).catch((error) => toast.error(error instanceof Error ? error.message : "Unable to load remarks.")).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [profileId, type]);

  const submit = async (event: React.FormEvent) => { event.preventDefault(); const trimmed = content.trim(); if (!trimmed || saving) return; setSaving(true); try { const response = await fetch("/api/customer-profiles/remarks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, profileId, content: trimmed }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Unable to add remark."); setRemarks((current) => [result.remark, ...current]); setContent(""); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to add remark."); } finally { setSaving(false); } };
  const remove = async (id: string) => { setDeletingId(id); try { const response = await fetch("/api/customer-profiles/remarks", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Unable to delete remark."); setRemarks((current) => current.filter((remark) => remark.id !== id)); setPendingDeleteId(null); toast.success("Remark deleted"); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to delete remark."); } finally { setDeletingId(null); } };

  return <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><header className="flex items-center gap-2 border-b border-slate-200 px-6 py-4"><MessageSquare size={18} className="text-[#16a5c4]" /><div><h2 className="font-semibold text-slate-900">Remarks</h2><p className="text-xs text-slate-500">Leave comments and profile notes for the team.</p></div></header><form onSubmit={submit} className="border-b border-slate-100 bg-slate-50/60 p-5"><textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Write a remark..." rows={3} className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#16a5c4] focus:ring-2 focus:ring-[#16a5c4]/15" /><div className="mt-2 flex justify-end"><button type="submit" disabled={saving || !content.trim()} className="inline-flex items-center gap-2 rounded-md bg-[#16a5c4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f8da8] disabled:cursor-not-allowed disabled:opacity-50">{saving ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={15} />}{saving ? "Posting..." : "Post remark"}</button></div></form><div className="space-y-3 p-5">{loading ? <div className="flex justify-center py-8 text-sm text-slate-400"><LoaderCircle size={17} className="mr-2 animate-spin" /> Loading remarks...</div> : remarks.length ? remarks.map((remark) => <article key={remark.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-xs font-semibold text-[#16a5c4]">{remark.authorName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2"><span className="text-sm font-semibold text-slate-800">{remark.authorName}</span><time className="text-xs text-slate-400">{new Date(remark.createdAt).toLocaleString("en-SG")}</time></div><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{remark.content}</p></div>{remark.canDelete && <button type="button" disabled={deletingId === remark.id} onClick={() => setPendingDeleteId(remark.id)} className="rounded p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-40" title="Delete remark">{deletingId === remark.id ? <LoaderCircle size={15} className="animate-spin" /> : <Trash2 size={15} />}</button>}</div></article>) : <p className="py-8 text-center text-sm text-slate-400">No remarks yet. Leave the first comment above.</p>}</div>{pendingDeleteId && <DeleteRemarkDialog deleting={deletingId === pendingDeleteId} onCancel={() => setPendingDeleteId(null)} onConfirm={() => void remove(pendingDeleteId)} />}</section>;
}

function normalizeProfilePhone(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeCompanyName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function ProfileLeads({ type, matchValue, boardClients, onOpenLead }: { type: "client" | "company"; matchValue: string | string[]; boardClients: Client[]; onOpenLead: (clientId: string) => void }) {
  const matchingLeads = useMemo(() => {
    const matchValues = Array.isArray(matchValue) ? matchValue : [matchValue];
    const normalizedMatches = new Set(matchValues.map((value) => type === "client" ? normalizeProfilePhone(value) : normalizeCompanyName(value)).filter(Boolean));
    if (!normalizedMatches.size) return [];
    return boardClients
      .filter((client) => normalizedMatches.has(type === "client" ? normalizeProfilePhone(client.phone ?? "") : normalizeCompanyName(client.company ?? "")))
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [boardClients, matchValue, type]);

  return <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><header className="flex items-center justify-between border-b border-slate-200 px-6 py-4"><div><h2 className="font-semibold text-slate-900">Leads / Past Leads with the {type === "client" ? "Client" : "Company"}</h2><p className="mt-0.5 text-xs text-slate-500">Matched from the CRM Board by {type === "client" ? "phone number" : "company name"}.</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{matchingLeads.length}</span></header><div className="divide-y divide-slate-100">{matchingLeads.map((lead) => <button key={lead.id} type="button" onClick={() => onOpenLead(lead.id)} className="flex w-full items-center gap-4 px-6 py-4 text-left transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sm font-semibold text-sky-600">{lead.name.trim().slice(0, 2).toUpperCase() || "?"}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{lead.name || "Unnamed lead"}</span><span className="mt-0.5 block truncate text-xs text-slate-500">{type === "client" ? lead.phone : lead.company}{lead.createdAt ? ` - Created ${new Date(lead.createdAt).toLocaleDateString("en-SG")}` : ""}</span></span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{lead.status || "No status"}</span><ChevronRight size={18} className="shrink-0 text-slate-300" /></button>)}{!matchingLeads.length && <p className="px-6 py-10 text-center text-sm text-slate-400">No matching leads were found on the CRM Board.</p>}</div></section>;
}

export function CustomerProfilesPanel({ currentUserRole, boardClients, onOpenLead }: { currentUserRole?: string | null; boardClients: Client[]; onOpenLead: (clientId: string) => void }) {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<"client" | "company" | null>(null);
  const [saving, setSaving] = useState(false);
  const [clientForm, setClientForm] = useState({ name: "", phoneNumber: "" });
  const [companyForm, setCompanyForm] = useState({ name: "", paymentTerm: "", industryOption: null as IndustryOption | null, industryCustomText: "", organizationType: "" });
  const [selectedProfile, setSelectedProfile] = useState<{ type: "client"; profile: ClientProfile } | { type: "company"; profile: CompanyProfile } | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingBlacklist, setConfirmingBlacklist] = useState(false);
  const [savingBlacklist, setSavingBlacklist] = useState(false);
  const [savingProfileEdits, setSavingProfileEdits] = useState(false);
  const canDeleteProfiles = ["admin", "director", "dev"].includes(currentUserRole?.toLowerCase() ?? "");
  const canManageBlacklist = ["director", "dev"].includes(currentUserRole?.toLowerCase() ?? "");
  const filteredClients = useMemo(() => { const query = clientSearch.trim().toLowerCase(); return query ? clients.filter((client) => `${client.name} ${clientPhoneNumbers(client).map((phone) => phone.phone_number).join(" ")}`.toLowerCase().includes(query)) : clients; }, [clientSearch, clients]);
  const filteredCompanies = useMemo(() => { const query = companySearch.trim().toLowerCase(); return query ? companies.filter((company) => company.name.toLowerCase().includes(query)) : companies; }, [companies, companySearch]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/customer-profiles");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load customer profiles.");
      setClients((result.clients ?? []).map((client: ClientProfile) => ({ ...client, phone_numbers: clientPhoneNumbers(client) })));
      setCompanies(result.companies ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load customer profiles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const addClient = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/customer-profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "client", ...clientForm }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to add client profile.");
      setClients((current) => [...current, result.client].sort((a, b) => a.name.localeCompare(b.name)));
      setClientForm({ name: "", phoneNumber: "" });
      setAdding(null);
      toast.success("Client profile added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add client profile.");
    } finally {
      setSaving(false);
    }
  };

  const addCompany = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/customer-profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "company", name: companyForm.name, paymentTerm: companyForm.paymentTerm, industryOptionId: companyForm.industryOption?.id ?? null, industryCustomText: companyForm.industryCustomText, organizationType: companyForm.organizationType }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to add company profile.");
      setCompanies((current) => [...current, result.company].sort((a, b) => a.name.localeCompare(b.name)));
      setCompanyForm({ name: "", paymentTerm: "", industryOption: null, industryCustomText: "", organizationType: "" });
      setAdding(null);
      toast.success("Company profile added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add company profile.");
    } finally {
      setSaving(false);
    }
  };

  const deleteSelectedProfile = async () => {
    if (!selectedProfile || !canDeleteProfiles) return;
    setDeleting(true);
    try {
      const response = await fetch("/api/customer-profiles", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: selectedProfile.type, id: selectedProfile.profile.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to delete customer profile.");
      if (selectedProfile.type === "client") setClients((current) => current.filter((client) => client.id !== selectedProfile.profile.id));
      else setCompanies((current) => current.filter((company) => company.id !== selectedProfile.profile.id));
      toast.success(`${selectedProfile.type === "client" ? "Client" : "Company"} profile deleted`);
      setConfirmingDelete(false);
      setSelectedProfile(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete customer profile.");
    } finally {
      setDeleting(false);
    }
  };

  const changeBlacklistStatus = async () => {
    if (selectedProfile?.type !== "client" || !canManageBlacklist) return;
    const nextBlacklisted = !selectedProfile.profile.is_blacklisted;
    setSavingBlacklist(true);
    try {
      const response = await fetch("/api/customer-profiles", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "client", id: selectedProfile.profile.id, isBlacklisted: nextBlacklisted }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to update blacklist status.");
      setClients((current) => current.map((profile) => profile.id === result.client.id ? result.client : profile));
      setSelectedProfile({ type: "client", profile: result.client });
      setConfirmingBlacklist(false);
      toast.success(nextBlacklisted ? "Client added to blacklist" : "Client removed from blacklist");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update blacklist status.");
    } finally {
      setSavingBlacklist(false);
    }
  };

  const saveProfileEdits = async () => {
    if (!selectedProfile) return;
    if (selectedProfile.type === "client") {
      const original = clients.find((item) => item.id === selectedProfile.profile.id);
      if (clientProfileValidationError(selectedProfile.profile, clients) || !original || clientProfileFingerprint(selectedProfile.profile) === clientProfileFingerprint(original)) return;
    } else {
      const original = companies.find((item) => item.id === selectedProfile.profile.id);
      if (!selectedProfile.profile.name.trim() || !original || companyProfileFingerprint(selectedProfile.profile) === companyProfileFingerprint(original)) return;
    }
    setSavingProfileEdits(true);
    try {
      const body = selectedProfile.type === "client"
        ? { type: "client", id: selectedProfile.profile.id, name: selectedProfile.profile.name, phoneNumbers: clientPhoneNumbers(selectedProfile.profile).map((phone) => ({ phoneNumber: phone.phone_number, isPrimary: phone.is_primary })) }
        : { type: "company", id: selectedProfile.profile.id, name: selectedProfile.profile.name, paymentTerm: selectedProfile.profile.payment_term ?? "", industryOptionId: selectedProfile.profile.industry_option_id, industryCustomText: selectedProfile.profile.industry_custom_text ?? (selectedProfile.profile.industry_option_id ? "" : selectedProfile.profile.industry ?? ""), organizationType: selectedProfile.profile.organization_type ?? "" };
      const response = await fetch("/api/customer-profiles", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save profile changes.");
      if (selectedProfile.type === "client") {
        setClients((current) => current.map((item) => item.id === result.client.id ? result.client : item).sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedProfile({ type: "client", profile: result.client });
      } else {
        setCompanies((current) => current.map((item) => item.id === result.company.id ? result.company : item).sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedProfile({ type: "company", profile: result.company });
      }
      toast.success("Profile changes saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save profile changes.");
    } finally {
      setSavingProfileEdits(false);
    }
  };

  if (selectedProfile?.type === "client") {
    const client = selectedProfile.profile;
    const originalClient = clients.find((item) => item.id === client.id);
    const validationError = clientProfileValidationError(client, clients);
    const hasChanges = Boolean(originalClient && clientProfileFingerprint(client) !== clientProfileFingerprint(originalClient));
    const saveDisabledReason = savingProfileEdits ? "Saving changes..." : validationError ?? (!hasChanges ? "No changes to save." : null);
    return <div className="min-h-full bg-[#f8fafc] p-5"><div className="mx-auto max-w-5xl"><button type="button" onClick={() => setSelectedProfile(null)} className="mb-4 inline-flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-slate-600 hover:bg-white hover:text-[#16a5c4]"><ArrowLeft size={17} /> Back to Customer Profiles</button><section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><header className="flex items-center gap-4 border-b border-slate-200 px-6 py-5"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-50 text-[#16a5c4]"><UserRound size={23} /></span><div><p className="text-xs font-semibold uppercase tracking-wide text-[#16a5c4]">Client Profile</p><h1 className="mt-1 text-2xl font-semibold text-slate-900">{client.name}</h1></div>{client.is_blacklisted && <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-red-700">Blacklisted</span>}{canDeleteProfiles && <button type="button" onClick={() => setConfirmingDelete(true)} className="ml-auto inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"><Trash2 size={16} /> Delete</button>}{canManageBlacklist && <button type="button" onClick={() => setConfirmingBlacklist(true)} className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${client.is_blacklisted ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50" : "border-red-200 text-red-600 hover:bg-red-50"}`}><AlertTriangle size={16} /> {client.is_blacklisted ? "Un-blacklist" : "Blacklist"}</button>}<button type="button" disabled={Boolean(saveDisabledReason)} title={saveDisabledReason ?? "Save changes"} onClick={() => void saveProfileEdits()} className="inline-flex items-center gap-2 rounded-md bg-[#16a5c4] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0f8da8] disabled:opacity-50">{savingProfileEdits ? <LoaderCircle size={15} className="animate-spin" /> : null}{savingProfileEdits ? "Saving..." : "Save changes"}</button></header><div className="grid gap-4 bg-slate-50/60 p-6 md:grid-cols-2">{validationError && <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 md:col-span-2"><AlertTriangle size={16} className="shrink-0" />{validationError}</div>}<ProfileEditField label="Name" icon={<UserRound size={15} /> }><input value={client.name} onChange={(event) => setSelectedProfile({ type: "client", profile: { ...client, name: event.target.value } })} className={inputClass} /></ProfileEditField><ProfileEditField label="Phone Numbers" icon={<Phone size={15} />}><ClientPhoneNumbersEditor client={client} onChange={(next) => setSelectedProfile({ type: "client", profile: next })} /></ProfileEditField></div></section><ProfileRemarks type="client" profileId={client.id} /><ProfileLeads type="client" matchValue={clientPhoneNumbers(client).map((phone) => phone.phone_number)} boardClients={boardClients} onOpenLead={onOpenLead} /></div>{confirmingDelete && <DeleteProfileDialog name={client.name} type="client" deleting={deleting} onCancel={() => setConfirmingDelete(false)} onConfirm={() => void deleteSelectedProfile()} />}{confirmingBlacklist && <BlacklistDialog name={client.name} blacklisted={client.is_blacklisted} saving={savingBlacklist} onCancel={() => setConfirmingBlacklist(false)} onConfirm={() => void changeBlacklistStatus()} />}</div>;
  }

  if (selectedProfile?.type === "company") {
    const company = selectedProfile.profile;
    const originalCompany = companies.find((item) => item.id === company.id);
    const validationError = !company.name.trim() ? "Company name is required." : null;
    const hasChanges = Boolean(originalCompany && companyProfileFingerprint(company) !== companyProfileFingerprint(originalCompany));
    const saveDisabledReason = savingProfileEdits ? "Saving changes..." : validationError ?? (!hasChanges ? "No changes to save." : null);
    return <div className="min-h-full bg-[#f8fafc] p-5"><div className="mx-auto max-w-5xl"><button type="button" onClick={() => setSelectedProfile(null)} className="mb-4 inline-flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-slate-600 hover:bg-white hover:text-violet-600"><ArrowLeft size={17} /> Back to Customer Profiles</button><section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><header className="flex items-center gap-4 border-b border-slate-200 px-6 py-5"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><Building2 size={23} /></span><div><p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Company Profile</p><h1 className="mt-1 text-2xl font-semibold text-slate-900">{company.name}</h1></div>{canDeleteProfiles && <button type="button" onClick={() => setConfirmingDelete(true)} className="ml-auto inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"><Trash2 size={16} /> Delete</button>}<button type="button" disabled={Boolean(saveDisabledReason)} title={saveDisabledReason ?? "Save changes"} onClick={() => void saveProfileEdits()} className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">{savingProfileEdits ? <LoaderCircle size={15} className="animate-spin" /> : null}{savingProfileEdits ? "Saving..." : "Save changes"}</button></header><div className="grid gap-4 bg-slate-50/60 p-6 md:grid-cols-2">{validationError && <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 md:col-span-2"><AlertTriangle size={16} className="shrink-0" />{validationError}</div>}<ProfileEditField label="Name" icon={<Building2 size={15} /> }><input value={company.name} onChange={(event) => setSelectedProfile({ type: "company", profile: { ...company, name: event.target.value } })} className={inputClass} /></ProfileEditField><ProfileEditField label="Payment Term" icon={<CreditCard size={15} />}><select value={company.payment_term ?? ""} onChange={(event) => setSelectedProfile({ type: "company", profile: { ...company, payment_term: event.target.value || null } })} className={inputClass}><option value="">Select payment term</option>{paymentTerms.map((term) => <option key={term} value={term}>{term}</option>)}</select></ProfileEditField><ProfileEditField label="Industry" icon={<Factory size={15} />}><IndustryCombobox value={{ option: company.industry_option, customText: company.industry_custom_text ?? (company.industry_option_id ? "" : company.industry ?? "") }} onChange={(next) => setSelectedProfile({ type: "company", profile: { ...company, industry: (next.option?.name ?? next.customText) || null, industry_option_id: next.option?.id ?? null, industry_custom_text: next.option ? null : next.customText || null, industry_option: next.option, industry_source: next.option ? "manual_ssic" : next.customText ? "manual_custom" : null } })} /></ProfileEditField><ProfileEditField label="Government / Semi / Private" icon={<Landmark size={15} />}><select value={company.organization_type ?? ""} onChange={(event) => setSelectedProfile({ type: "company", profile: { ...company, organization_type: event.target.value || null } })} className={inputClass}><option value="">Select type</option><option>Government</option><option>Semi</option><option>Private</option></select></ProfileEditField></div></section><ProfileRemarks type="company" profileId={company.id} /><ProfileLeads type="company" matchValue={company.name} boardClients={boardClients} onOpenLead={onOpenLead} /></div>{confirmingDelete && <DeleteProfileDialog name={company.name} type="company" deleting={deleting} onCancel={() => setConfirmingDelete(false)} onConfirm={() => void deleteSelectedProfile()} />}</div>;
  }

  return <div className="min-h-full bg-[#f8fafc] p-5">
    <div className="mx-auto max-w-7xl">
      <div className="mb-5"><h1 className="text-xl font-semibold text-slate-900">Customer Profiles</h1><p className="mt-1 text-sm text-slate-500">Maintain reusable client and company information.</p></div>
      {loading ? <div className="flex min-h-64 items-center justify-center text-slate-400"><LoaderCircle className="mr-2 animate-spin" size={20} /> Loading profiles...</div> : <div className="grid items-start gap-5 xl:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-50 text-[#16a5c4]"><UserRound size={18} /></span><div><h2 className="font-semibold text-slate-900">Client Profiles</h2><p className="text-xs text-slate-500">Identified by unique phone number - {clients.length} profile{clients.length === 1 ? "" : "s"}</p></div></div><button onClick={() => setAdding(adding === "client" ? null : "client")} className="inline-flex items-center gap-1.5 rounded-md bg-[#16a5c4] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0f8da8]">{adding === "client" ? <X size={14} /> : <Plus size={14} />}{adding === "client" ? "Close" : "New client"}</button></header>
          {adding === "client" && <form onSubmit={addClient} className="grid gap-3 border-b border-cyan-100 bg-cyan-50/40 p-5 sm:grid-cols-2"><label className="grid gap-1.5 text-xs font-medium text-slate-600">Name *<input required value={clientForm.name} onChange={(event) => setClientForm((current) => ({ ...current, name: event.target.value }))} className={inputClass} /></label><label className="grid gap-1.5 text-xs font-medium text-slate-600">Phone number *<input required type="tel" value={clientForm.phoneNumber} onChange={(event) => setClientForm((current) => ({ ...current, phoneNumber: event.target.value }))} className={inputClass} /></label><div className="flex justify-end sm:col-span-2"><button disabled={saving} className="rounded-md bg-[#16a5c4] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Adding..." : "Add client"}</button></div></form>}
          <div className="border-b border-slate-100 p-3"><div className="relative"><Search size={16} className="absolute left-3 top-2.5 text-slate-400" /><input value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} placeholder="Search by name or phone number" className="h-9 w-full rounded-md border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-[#16a5c4]" /></div></div><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Phone number</th><th className="w-12 px-3 py-3" /></tr></thead><tbody>{filteredClients.map((client) => <tr key={client.id} tabIndex={0} role="button" onClick={() => setSelectedProfile({ type: "client", profile: client })} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedProfile({ type: "client", profile: client }); }} className="cursor-pointer border-t border-slate-100 transition hover:bg-cyan-50/60 focus:bg-cyan-50/60 focus:outline-none"><td className="px-5 py-3"><div className="flex items-center gap-2"><span className="font-medium text-slate-800">{client.name}</span>{client.is_blacklisted && <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700">Blacklisted</span>}</div></td><td className="whitespace-nowrap px-5 py-3 text-slate-600">{client.phone_number}</td><td className="px-3 py-3 text-slate-300"><ChevronRight size={17} /></td></tr>)}{!filteredClients.length && <tr><td colSpan={3} className="px-5 py-10 text-center text-slate-400">{clients.length ? "No client profiles match your search." : "No client profiles yet."}</td></tr>}</tbody></table></div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><Building2 size={18} /></span><div><h2 className="font-semibold text-slate-900">Company Profiles</h2><p className="text-xs text-slate-500">Identified by unique company name - {companies.length} profile{companies.length === 1 ? "" : "s"}</p></div></div><button onClick={() => setAdding(adding === "company" ? null : "company")} className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700">{adding === "company" ? <X size={14} /> : <Plus size={14} />}{adding === "company" ? "Close" : "New company"}</button></header>
          {adding === "company" && <form onSubmit={addCompany} className="grid gap-3 border-b border-violet-100 bg-violet-50/40 p-5 sm:grid-cols-2"><label className="grid gap-1.5 text-xs font-medium text-slate-600">Name *<input required value={companyForm.name} onChange={(event) => setCompanyForm((current) => ({ ...current, name: event.target.value }))} className={inputClass} /></label><label className="grid gap-1.5 text-xs font-medium text-slate-600">Payment Term<select value={companyForm.paymentTerm} onChange={(event) => setCompanyForm((current) => ({ ...current, paymentTerm: event.target.value }))} className={inputClass}><option value="">Select payment term</option>{paymentTerms.map((term) => <option key={term} value={term}>{term}</option>)}</select></label><div className="grid gap-1.5 text-xs font-medium text-slate-600">Industry<IndustryCombobox value={{ option: companyForm.industryOption, customText: companyForm.industryCustomText }} onChange={(next) => setCompanyForm((current) => ({ ...current, industryOption: next.option, industryCustomText: next.customText }))} /></div><label className="grid gap-1.5 text-xs font-medium text-slate-600">Government / Semi / Private<select value={companyForm.organizationType} onChange={(event) => setCompanyForm((current) => ({ ...current, organizationType: event.target.value }))} className={inputClass}><option value="">Select type</option><option>Government</option><option>Semi</option><option>Private</option></select></label><div className="flex justify-end sm:col-span-2"><button disabled={saving} className="rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Adding..." : "Add company"}</button></div></form>}
          <div className="border-b border-slate-100 p-3"><div className="relative"><Search size={16} className="absolute left-3 top-2.5 text-slate-400" /><input value={companySearch} onChange={(event) => setCompanySearch(event.target.value)} placeholder="Search company profiles" className="h-9 w-full rounded-md border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-violet-400" /></div></div><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Name</th><th className="w-12 px-3 py-3" /></tr></thead><tbody>{filteredCompanies.map((company) => <tr key={company.id} tabIndex={0} role="button" onClick={() => setSelectedProfile({ type: "company", profile: company })} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedProfile({ type: "company", profile: company }); }} className="cursor-pointer border-t border-slate-100 transition hover:bg-violet-50/60 focus:bg-violet-50/60 focus:outline-none"><td className="px-5 py-3 font-medium text-slate-800">{company.name}</td><td className="px-3 py-3 text-slate-300"><ChevronRight size={17} /></td></tr>)}{!filteredCompanies.length && <tr><td colSpan={2} className="px-5 py-10 text-center text-slate-400">{companies.length ? "No company profiles match your search." : "No company profiles yet."}</td></tr>}</tbody></table></div>
        </section>
      </div>}
    </div>
  </div>;
}
