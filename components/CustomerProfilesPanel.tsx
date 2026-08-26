"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Building2, ChevronRight, CreditCard, Factory, Landmark, LoaderCircle, MessageSquare, Phone, Plus, Search, Send, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import type { Client } from "@/app/types";

type ClientProfile = { id: string; phone_number: string; name: string; remarks: string | null; is_blacklisted: boolean; blacklisted_at: string | null };
type CompanyProfile = { id: string; name: string; payment_term: string | null; industry: string | null; organization_type: string | null; remarks: string | null };

const inputClass = "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#16a5c4] focus:ring-2 focus:ring-[#16a5c4]/15";
const paymentTerms = ["Net 30", "Net 60", "Net 90", "Due on Receipt", "End of Month (EOM)", "Cash on Delivery (COD)", "Payment in Advance (PIA)"];

function ProfileEditField({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <label className="rounded-xl border border-slate-200 bg-white p-4"><span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{icon}{label}</span><span className="mt-2 block">{children}</span></label>;
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

function ProfileLeads({ type, matchValue, boardClients, onOpenLead }: { type: "client" | "company"; matchValue: string; boardClients: Client[]; onOpenLead: (clientId: string) => void }) {
  const matchingLeads = useMemo(() => {
    const normalizedMatch = type === "client" ? normalizeProfilePhone(matchValue) : normalizeCompanyName(matchValue);
    if (!normalizedMatch) return [];
    return boardClients
      .filter((client) => type === "client" ? normalizeProfilePhone(client.phone ?? "") === normalizedMatch : normalizeCompanyName(client.company ?? "") === normalizedMatch)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [boardClients, matchValue, type]);

  return <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><header className="flex items-center justify-between border-b border-slate-200 px-6 py-4"><div><h2 className="font-semibold text-slate-900">Leads / Past Leads with the {type === "client" ? "Client" : "Company"}</h2><p className="mt-0.5 text-xs text-slate-500">Matched from the CRM Board by {type === "client" ? "phone number" : "company name"}.</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{matchingLeads.length}</span></header><div className="divide-y divide-slate-100">{matchingLeads.map((lead) => <button key={lead.id} type="button" onClick={() => onOpenLead(lead.id)} className="flex w-full items-center gap-4 px-6 py-4 text-left transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sm font-semibold text-sky-600">{lead.name.trim().slice(0, 2).toUpperCase() || "?"}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{lead.name || "Unnamed lead"}</span><span className="mt-0.5 block truncate text-xs text-slate-500">{type === "client" ? lead.phone : lead.company}{lead.createdAt ? ` · Created ${new Date(lead.createdAt).toLocaleDateString("en-SG")}` : ""}</span></span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{lead.status || "No status"}</span><ChevronRight size={18} className="shrink-0 text-slate-300" /></button>)}{!matchingLeads.length && <p className="px-6 py-10 text-center text-sm text-slate-400">No matching leads were found on the CRM Board.</p>}</div></section>;
}

export function CustomerProfilesPanel({ currentUserRole, boardClients, onOpenLead }: { currentUserRole?: string | null; boardClients: Client[]; onOpenLead: (clientId: string) => void }) {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<"client" | "company" | null>(null);
  const [saving, setSaving] = useState(false);
  const [clientForm, setClientForm] = useState({ name: "", phoneNumber: "" });
  const [companyForm, setCompanyForm] = useState({ name: "", paymentTerm: "", industry: "", organizationType: "" });
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
  const filteredClients = useMemo(() => { const query = clientSearch.trim().toLowerCase(); return query ? clients.filter((client) => `${client.name} ${client.phone_number}`.toLowerCase().includes(query)) : clients; }, [clientSearch, clients]);
  const filteredCompanies = useMemo(() => { const query = companySearch.trim().toLowerCase(); return query ? companies.filter((company) => company.name.toLowerCase().includes(query)) : companies; }, [companies, companySearch]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/customer-profiles");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load customer profiles.");
      setClients(result.clients ?? []);
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
      const response = await fetch("/api/customer-profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "company", ...companyForm }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to add company profile.");
      setCompanies((current) => [...current, result.company].sort((a, b) => a.name.localeCompare(b.name)));
      setCompanyForm({ name: "", paymentTerm: "", industry: "", organizationType: "" });
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
    setSavingProfileEdits(true);
    try {
      const body = selectedProfile.type === "client"
        ? { type: "client", id: selectedProfile.profile.id, name: selectedProfile.profile.name, phoneNumber: selectedProfile.profile.phone_number }
        : { type: "company", id: selectedProfile.profile.id, name: selectedProfile.profile.name, paymentTerm: selectedProfile.profile.payment_term ?? "", industry: selectedProfile.profile.industry ?? "", organizationType: selectedProfile.profile.organization_type ?? "" };
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
    return <div className="min-h-full bg-[#f8fafc] p-5"><div className="mx-auto max-w-5xl"><button type="button" onClick={() => setSelectedProfile(null)} className="mb-4 inline-flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-slate-600 hover:bg-white hover:text-[#16a5c4]"><ArrowLeft size={17} /> Back to Customer Profiles</button><section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><header className="flex items-center gap-4 border-b border-slate-200 px-6 py-5"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-50 text-[#16a5c4]"><UserRound size={23} /></span><div><p className="text-xs font-semibold uppercase tracking-wide text-[#16a5c4]">Client Profile</p><h1 className="mt-1 text-2xl font-semibold text-slate-900">{client.name}</h1></div>{client.is_blacklisted && <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-red-700">Blacklisted</span>}{canDeleteProfiles && <button type="button" onClick={() => setConfirmingDelete(true)} className="ml-auto inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"><Trash2 size={16} /> Delete</button>}{canManageBlacklist && <button type="button" onClick={() => setConfirmingBlacklist(true)} className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${client.is_blacklisted ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50" : "border-red-200 text-red-600 hover:bg-red-50"}`}><AlertTriangle size={16} /> {client.is_blacklisted ? "Un-blacklist" : "Blacklist"}</button>}<button type="button" disabled={savingProfileEdits || !client.name.trim() || !client.phone_number.trim()} onClick={() => void saveProfileEdits()} className="inline-flex items-center gap-2 rounded-md bg-[#16a5c4] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0f8da8] disabled:opacity-50">{savingProfileEdits ? <LoaderCircle size={15} className="animate-spin" /> : null}{savingProfileEdits ? "Saving..." : "Save changes"}</button></header><div className="grid gap-4 bg-slate-50/60 p-6 md:grid-cols-2"><ProfileEditField label="Name" icon={<UserRound size={15} />}><input value={client.name} onChange={(event) => setSelectedProfile({ type: "client", profile: { ...client, name: event.target.value } })} className={inputClass} /></ProfileEditField><ProfileEditField label="Phone Number" icon={<Phone size={15} />}><input type="tel" value={client.phone_number} onChange={(event) => setSelectedProfile({ type: "client", profile: { ...client, phone_number: event.target.value } })} className={inputClass} /></ProfileEditField></div></section><ProfileRemarks type="client" profileId={client.id} /><ProfileLeads type="client" matchValue={client.phone_number} boardClients={boardClients} onOpenLead={onOpenLead} /></div>{confirmingDelete && <DeleteProfileDialog name={client.name} type="client" deleting={deleting} onCancel={() => setConfirmingDelete(false)} onConfirm={() => void deleteSelectedProfile()} />}{confirmingBlacklist && <BlacklistDialog name={client.name} blacklisted={client.is_blacklisted} saving={savingBlacklist} onCancel={() => setConfirmingBlacklist(false)} onConfirm={() => void changeBlacklistStatus()} />}</div>;
  }

  if (selectedProfile?.type === "company") {
    const company = selectedProfile.profile;
    return <div className="min-h-full bg-[#f8fafc] p-5"><div className="mx-auto max-w-5xl"><button type="button" onClick={() => setSelectedProfile(null)} className="mb-4 inline-flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-slate-600 hover:bg-white hover:text-violet-600"><ArrowLeft size={17} /> Back to Customer Profiles</button><section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><header className="flex items-center gap-4 border-b border-slate-200 px-6 py-5"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><Building2 size={23} /></span><div><p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Company Profile</p><h1 className="mt-1 text-2xl font-semibold text-slate-900">{company.name}</h1></div>{canDeleteProfiles && <button type="button" onClick={() => setConfirmingDelete(true)} className="ml-auto inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"><Trash2 size={16} /> Delete</button>}<button type="button" disabled={savingProfileEdits || !company.name.trim()} onClick={() => void saveProfileEdits()} className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">{savingProfileEdits ? <LoaderCircle size={15} className="animate-spin" /> : null}{savingProfileEdits ? "Saving..." : "Save changes"}</button></header><div className="grid gap-4 bg-slate-50/60 p-6 md:grid-cols-2"><ProfileEditField label="Name" icon={<Building2 size={15} />}><input value={company.name} onChange={(event) => setSelectedProfile({ type: "company", profile: { ...company, name: event.target.value } })} className={inputClass} /></ProfileEditField><ProfileEditField label="Payment Term" icon={<CreditCard size={15} />}><select value={company.payment_term ?? ""} onChange={(event) => setSelectedProfile({ type: "company", profile: { ...company, payment_term: event.target.value || null } })} className={inputClass}><option value="">Select payment term</option>{paymentTerms.map((term) => <option key={term} value={term}>{term}</option>)}</select></ProfileEditField><ProfileEditField label="Industry" icon={<Factory size={15} />}><input value={company.industry ?? ""} onChange={(event) => setSelectedProfile({ type: "company", profile: { ...company, industry: event.target.value || null } })} className={inputClass} /></ProfileEditField><ProfileEditField label="Government / Semi / Private" icon={<Landmark size={15} />}><select value={company.organization_type ?? ""} onChange={(event) => setSelectedProfile({ type: "company", profile: { ...company, organization_type: event.target.value || null } })} className={inputClass}><option value="">Select type</option><option>Government</option><option>Semi</option><option>Private</option></select></ProfileEditField></div></section><ProfileRemarks type="company" profileId={company.id} /><ProfileLeads type="company" matchValue={company.name} boardClients={boardClients} onOpenLead={onOpenLead} /></div>{confirmingDelete && <DeleteProfileDialog name={company.name} type="company" deleting={deleting} onCancel={() => setConfirmingDelete(false)} onConfirm={() => void deleteSelectedProfile()} />}</div>;
  }

  return <div className="min-h-full bg-[#f8fafc] p-5">
    <div className="mx-auto max-w-7xl">
      <div className="mb-5"><h1 className="text-xl font-semibold text-slate-900">Customer Profiles</h1><p className="mt-1 text-sm text-slate-500">Maintain reusable client and company information.</p></div>
      {loading ? <div className="flex min-h-64 items-center justify-center text-slate-400"><LoaderCircle className="mr-2 animate-spin" size={20} /> Loading profiles...</div> : <div className="grid items-start gap-5 xl:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-50 text-[#16a5c4]"><UserRound size={18} /></span><div><h2 className="font-semibold text-slate-900">Client Profiles</h2><p className="text-xs text-slate-500">Identified by unique phone number · {clients.length} profile{clients.length === 1 ? "" : "s"}</p></div></div><button onClick={() => setAdding(adding === "client" ? null : "client")} className="inline-flex items-center gap-1.5 rounded-md bg-[#16a5c4] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0f8da8]">{adding === "client" ? <X size={14} /> : <Plus size={14} />}{adding === "client" ? "Close" : "New client"}</button></header>
          {adding === "client" && <form onSubmit={addClient} className="grid gap-3 border-b border-cyan-100 bg-cyan-50/40 p-5 sm:grid-cols-2"><label className="grid gap-1.5 text-xs font-medium text-slate-600">Name *<input required value={clientForm.name} onChange={(event) => setClientForm((current) => ({ ...current, name: event.target.value }))} className={inputClass} /></label><label className="grid gap-1.5 text-xs font-medium text-slate-600">Phone number *<input required type="tel" value={clientForm.phoneNumber} onChange={(event) => setClientForm((current) => ({ ...current, phoneNumber: event.target.value }))} className={inputClass} /></label><div className="flex justify-end sm:col-span-2"><button disabled={saving} className="rounded-md bg-[#16a5c4] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Adding..." : "Add client"}</button></div></form>}
          <div className="border-b border-slate-100 p-3"><div className="relative"><Search size={16} className="absolute left-3 top-2.5 text-slate-400" /><input value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} placeholder="Search by name or phone number" className="h-9 w-full rounded-md border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-[#16a5c4]" /></div></div><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Phone number</th><th className="w-12 px-3 py-3" /></tr></thead><tbody>{filteredClients.map((client) => <tr key={client.id} tabIndex={0} role="button" onClick={() => setSelectedProfile({ type: "client", profile: client })} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedProfile({ type: "client", profile: client }); }} className="cursor-pointer border-t border-slate-100 transition hover:bg-cyan-50/60 focus:bg-cyan-50/60 focus:outline-none"><td className="px-5 py-3"><div className="flex items-center gap-2"><span className="font-medium text-slate-800">{client.name}</span>{client.is_blacklisted && <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700">Blacklisted</span>}</div></td><td className="whitespace-nowrap px-5 py-3 text-slate-600">{client.phone_number}</td><td className="px-3 py-3 text-slate-300"><ChevronRight size={17} /></td></tr>)}{!filteredClients.length && <tr><td colSpan={3} className="px-5 py-10 text-center text-slate-400">{clients.length ? "No client profiles match your search." : "No client profiles yet."}</td></tr>}</tbody></table></div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><Building2 size={18} /></span><div><h2 className="font-semibold text-slate-900">Company Profiles</h2><p className="text-xs text-slate-500">Identified by unique company name · {companies.length} profile{companies.length === 1 ? "" : "s"}</p></div></div><button onClick={() => setAdding(adding === "company" ? null : "company")} className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700">{adding === "company" ? <X size={14} /> : <Plus size={14} />}{adding === "company" ? "Close" : "New company"}</button></header>
          {adding === "company" && <form onSubmit={addCompany} className="grid gap-3 border-b border-violet-100 bg-violet-50/40 p-5 sm:grid-cols-2"><label className="grid gap-1.5 text-xs font-medium text-slate-600">Name *<input required value={companyForm.name} onChange={(event) => setCompanyForm((current) => ({ ...current, name: event.target.value }))} className={inputClass} /></label><label className="grid gap-1.5 text-xs font-medium text-slate-600">Payment Term<select value={companyForm.paymentTerm} onChange={(event) => setCompanyForm((current) => ({ ...current, paymentTerm: event.target.value }))} className={inputClass}><option value="">Select payment term</option>{paymentTerms.map((term) => <option key={term} value={term}>{term}</option>)}</select></label><label className="grid gap-1.5 text-xs font-medium text-slate-600">Industry<input value={companyForm.industry} onChange={(event) => setCompanyForm((current) => ({ ...current, industry: event.target.value }))} className={inputClass} /></label><label className="grid gap-1.5 text-xs font-medium text-slate-600">Government / Semi / Private<select value={companyForm.organizationType} onChange={(event) => setCompanyForm((current) => ({ ...current, organizationType: event.target.value }))} className={inputClass}><option value="">Select type</option><option>Government</option><option>Semi</option><option>Private</option></select></label><div className="flex justify-end sm:col-span-2"><button disabled={saving} className="rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Adding..." : "Add company"}</button></div></form>}
          <div className="border-b border-slate-100 p-3"><div className="relative"><Search size={16} className="absolute left-3 top-2.5 text-slate-400" /><input value={companySearch} onChange={(event) => setCompanySearch(event.target.value)} placeholder="Search company profiles" className="h-9 w-full rounded-md border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-violet-400" /></div></div><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Name</th><th className="w-12 px-3 py-3" /></tr></thead><tbody>{filteredCompanies.map((company) => <tr key={company.id} tabIndex={0} role="button" onClick={() => setSelectedProfile({ type: "company", profile: company })} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedProfile({ type: "company", profile: company }); }} className="cursor-pointer border-t border-slate-100 transition hover:bg-violet-50/60 focus:bg-violet-50/60 focus:outline-none"><td className="px-5 py-3 font-medium text-slate-800">{company.name}</td><td className="px-3 py-3 text-slate-300"><ChevronRight size={17} /></td></tr>)}{!filteredCompanies.length && <tr><td colSpan={2} className="px-5 py-10 text-center text-slate-400">{companies.length ? "No company profiles match your search." : "No company profiles yet."}</td></tr>}</tbody></table></div>
        </section>
      </div>}
    </div>
  </div>;
}
