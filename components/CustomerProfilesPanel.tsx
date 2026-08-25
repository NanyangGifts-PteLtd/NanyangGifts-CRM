"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, LoaderCircle, Plus, UserRound, X } from "lucide-react";
import { toast } from "sonner";

type ClientProfile = { id: string; phone_number: string; name: string; remarks: string | null };
type CompanyProfile = { id: string; name: string; payment_term: string | null; industry: string | null; organization_type: string | null; remarks: string | null };

const inputClass = "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#16a5c4] focus:ring-2 focus:ring-[#16a5c4]/15";
const textareaClass = "min-h-20 w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#16a5c4] focus:ring-2 focus:ring-[#16a5c4]/15";

export function CustomerProfilesPanel() {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<"client" | "company" | null>(null);
  const [saving, setSaving] = useState(false);
  const [clientForm, setClientForm] = useState({ name: "", phoneNumber: "", remarks: "" });
  const [companyForm, setCompanyForm] = useState({ name: "", paymentTerm: "", industry: "", organizationType: "", remarks: "" });

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
      setClientForm({ name: "", phoneNumber: "", remarks: "" });
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
      setCompanyForm({ name: "", paymentTerm: "", industry: "", organizationType: "", remarks: "" });
      setAdding(null);
      toast.success("Company profile added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add company profile.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="min-h-full bg-[#f8fafc] p-5">
    <div className="mx-auto max-w-7xl">
      <div className="mb-5"><h1 className="text-xl font-semibold text-slate-900">Customer Profiles</h1><p className="mt-1 text-sm text-slate-500">Maintain reusable client and company information.</p></div>
      {loading ? <div className="flex min-h-64 items-center justify-center text-slate-400"><LoaderCircle className="mr-2 animate-spin" size={20} /> Loading profiles...</div> : <div className="grid items-start gap-5 xl:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-50 text-[#16a5c4]"><UserRound size={18} /></span><div><h2 className="font-semibold text-slate-900">Client Profiles</h2><p className="text-xs text-slate-500">Identified by unique phone number · {clients.length} profile{clients.length === 1 ? "" : "s"}</p></div></div><button onClick={() => setAdding(adding === "client" ? null : "client")} className="inline-flex items-center gap-1.5 rounded-md bg-[#16a5c4] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0f8da8]">{adding === "client" ? <X size={14} /> : <Plus size={14} />}{adding === "client" ? "Close" : "New client"}</button></header>
          {adding === "client" && <form onSubmit={addClient} className="grid gap-3 border-b border-cyan-100 bg-cyan-50/40 p-5 sm:grid-cols-2"><label className="grid gap-1.5 text-xs font-medium text-slate-600">Name *<input required value={clientForm.name} onChange={(event) => setClientForm((current) => ({ ...current, name: event.target.value }))} className={inputClass} /></label><label className="grid gap-1.5 text-xs font-medium text-slate-600">Phone number *<input required type="tel" value={clientForm.phoneNumber} onChange={(event) => setClientForm((current) => ({ ...current, phoneNumber: event.target.value }))} className={inputClass} /></label><label className="grid gap-1.5 text-xs font-medium text-slate-600 sm:col-span-2">Remarks<textarea value={clientForm.remarks} onChange={(event) => setClientForm((current) => ({ ...current, remarks: event.target.value }))} className={textareaClass} /></label><div className="flex justify-end sm:col-span-2"><button disabled={saving} className="rounded-md bg-[#16a5c4] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Adding..." : "Add client"}</button></div></form>}
          <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Phone number</th><th className="px-5 py-3">Remarks</th></tr></thead><tbody>{clients.map((client) => <tr key={client.id} className="border-t border-slate-100"><td className="px-5 py-3 font-medium text-slate-800">{client.name}</td><td className="whitespace-nowrap px-5 py-3 text-slate-600">{client.phone_number}</td><td className="max-w-xs whitespace-pre-wrap px-5 py-3 text-slate-600">{client.remarks || "—"}</td></tr>)}{!clients.length && <tr><td colSpan={3} className="px-5 py-10 text-center text-slate-400">No client profiles yet.</td></tr>}</tbody></table></div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><Building2 size={18} /></span><div><h2 className="font-semibold text-slate-900">Company Profiles</h2><p className="text-xs text-slate-500">Identified by unique company name · {companies.length} profile{companies.length === 1 ? "" : "s"}</p></div></div><button onClick={() => setAdding(adding === "company" ? null : "company")} className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700">{adding === "company" ? <X size={14} /> : <Plus size={14} />}{adding === "company" ? "Close" : "New company"}</button></header>
          {adding === "company" && <form onSubmit={addCompany} className="grid gap-3 border-b border-violet-100 bg-violet-50/40 p-5 sm:grid-cols-2"><label className="grid gap-1.5 text-xs font-medium text-slate-600">Name *<input required value={companyForm.name} onChange={(event) => setCompanyForm((current) => ({ ...current, name: event.target.value }))} className={inputClass} /></label><label className="grid gap-1.5 text-xs font-medium text-slate-600">Payment Term<input value={companyForm.paymentTerm} onChange={(event) => setCompanyForm((current) => ({ ...current, paymentTerm: event.target.value }))} placeholder="e.g. Net 30" className={inputClass} /></label><label className="grid gap-1.5 text-xs font-medium text-slate-600">Industry<input value={companyForm.industry} onChange={(event) => setCompanyForm((current) => ({ ...current, industry: event.target.value }))} className={inputClass} /></label><label className="grid gap-1.5 text-xs font-medium text-slate-600">Government / Semi / Private<select value={companyForm.organizationType} onChange={(event) => setCompanyForm((current) => ({ ...current, organizationType: event.target.value }))} className={inputClass}><option value="">Select type</option><option>Government</option><option>Semi</option><option>Private</option></select></label><label className="grid gap-1.5 text-xs font-medium text-slate-600 sm:col-span-2">Remarks<textarea value={companyForm.remarks} onChange={(event) => setCompanyForm((current) => ({ ...current, remarks: event.target.value }))} className={textareaClass} /></label><div className="flex justify-end sm:col-span-2"><button disabled={saving} className="rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Adding..." : "Add company"}</button></div></form>}
          <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Payment Term</th><th className="px-4 py-3">Industry</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Remarks</th></tr></thead><tbody>{companies.map((company) => <tr key={company.id} className="border-t border-slate-100"><td className="px-4 py-3 font-medium text-slate-800">{company.name}</td><td className="whitespace-nowrap px-4 py-3 text-slate-600">{company.payment_term || "—"}</td><td className="px-4 py-3 text-slate-600">{company.industry || "—"}</td><td className="whitespace-nowrap px-4 py-3 text-slate-600">{company.organization_type || "—"}</td><td className="max-w-xs whitespace-pre-wrap px-4 py-3 text-slate-600">{company.remarks || "—"}</td></tr>)}{!companies.length && <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400">No company profiles yet.</td></tr>}</tbody></table></div>
        </section>
      </div>}
    </div>
  </div>;
}
