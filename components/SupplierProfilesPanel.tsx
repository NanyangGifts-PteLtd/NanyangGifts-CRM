"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Building2,
  GripVertical,
  LoaderCircle,
  Plus,
  Send,
  Star,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

type Supplier = { id: string; name: string; contact?: string; is_blacklisted: boolean; is_starred?: boolean; tags?: Tag[]; productNames?: string[] };
type Tag = { id: string; name: string; color: string; sort_order?: number };
type Lead = { id: string; name: string; display_id?: string | null };
type Product = {
  id: string;
  name: string;
  subitemCount: number;
  leads?: Lead[];
};
type Remark = {
  id: string;
  content: string;
  created_at: string;
  author?: { full_name?: string | null; email?: string | null } | null;
};
type Detail = { supplier: Supplier; products: Product[]; remarks: Remark[]; tags: Tag[]; tagOptions: Tag[] };
type Deletion = {
  kind: "supplier" | "remark" | "product";
  id: string;
  name?: string;
  activeCount?: number;
};

const request = async (method: string, body?: unknown) => {
  const response = await fetch("/api/supplier-profiles", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error ?? "Request failed.");
  return json;
};

export function SupplierProfilesPanel() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [listTagOptions, setListTagOptions] = useState<Tag[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createTagSearch, setCreateTagSearch] = useState("");
  const [createProductInput, setCreateProductInput] = useState("");
  const [createDraft, setCreateDraft] = useState({ name: "", contact: "", tagIds: [] as string[], productNames: [] as string[], isStarred: false, isBlacklisted: false });
  const [productName, setProductName] = useState("");
  const [remark, setRemark] = useState("");
  const [leadsFor, setLeadsFor] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Deletion | null>(null);
  const [blacklistConfirm, setBlacklistConfirm] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [tagSearch, setTagSearch] = useState("");
  const [newTag, setNewTag] = useState("");
  const [tagSelectorOpen, setTagSelectorOpen] = useState(false);
  const [tagEditMode, setTagEditMode] = useState(false);
  const [draggedTagId, setDraggedTagId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await request("GET");
    setSuppliers(result.suppliers ?? []);
    setListTagOptions(result.tagOptions ?? []);
  }, []);
  const open = useCallback(async (id: string) => {
    setPending(`open:${id}`);
    try {
      const response = await fetch(`/api/supplier-profiles?id=${id}`);
      const json = await response.json();
      if (!response.ok)
        throw new Error(json.error ?? "Could not load supplier.");
      setDetail(json);
    } finally {
      setPending(null);
    }
  }, []);
  const reload = async () => {
    if (detail) await open(detail.supplier.id);
  };

  useEffect(() => {
    void load().catch((error) => toast.error(error.message));
  }, [load]);

  const createSupplier = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!createDraft.name.trim()) {
      toast.error("Supplier name is required.");
      return;
    }
    if (suppliers.some((supplier) => supplier.name.trim().replace(/\s+/g, " ").toLowerCase() === createDraft.name.trim().replace(/\s+/g, " ").toLowerCase())) {
      toast.error("A supplier profile with this name already exists.");
      return;
    }
    setPending("create-supplier");
    try {
      const json = await request("POST", createDraft);
      setCreateOpen(false);
      setCreateTagSearch("");
      setCreateProductInput("");
      setCreateDraft({ name: "", contact: "", tagIds: [], productNames: [], isStarred: false, isBlacklisted: false });
      await load();
      await open(json.supplier.id);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not add supplier.",
      );
    } finally {
      setPending(null);
    }
  };
  const addDraftProduct = () => {
    const name = createProductInput.trim();
    if (!name || createDraft.productNames.some((item) => item.trim().toLowerCase() === name.toLowerCase())) return;
    setCreateDraft((current) => ({ ...current, productNames: [...current.productNames, name] }));
    setCreateProductInput("");
  };
  const toggleListStar = async (supplier: Supplier) => {
    const previous = supplier.is_starred ?? false;
    setSuppliers((current) => current.map((item) => item.id === supplier.id
      ? { ...item, is_starred: !previous, is_blacklisted: !previous ? false : item.is_blacklisted }
      : item));
    setPending(`star:${supplier.id}`);
    try {
      const json = await request("PATCH", { id: supplier.id, isStarred: !previous });
      setSuppliers((current) => current.map((item) => item.id === supplier.id ? { ...item, ...json.supplier } : item));
    } catch (error) {
      setSuppliers((current) => current.map((item) => item.id === supplier.id ? { ...item, is_starred: previous } : item));
      toast.error(error instanceof Error ? error.message : "Could not update supplier star.");
    } finally {
      setPending(null);
    }
  };
  const addProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!detail || !productName.trim()) return;
    setPending("add-product");
    try {
      await request("POST", {
        action: "product",
        supplierId: detail.supplier.id,
        name: productName,
      });
      setProductName("");
      await reload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not add subitem.",
      );
    } finally {
      setPending(null);
    }
  };
  const addRemark = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!detail || !remark.trim()) return;
    setPending("add-remark");
    try {
      const json = await request("POST", {
        action: "remark",
        supplierId: detail.supplier.id,
        content: remark,
      });
      setRemark("");
      setDetail((current) =>
        current
          ? { ...current, remarks: [json.remark, ...current.remarks] }
          : current,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not add remark.",
      );
    } finally {
      setPending(null);
    }
  };
  const saveSupplier = async (changes: Record<string, unknown>) => {
    if (!detail) return;
    const action = changes.isBlacklisted !== undefined ? "blacklist" : changes.isStarred !== undefined ? "star" : "save-supplier";
    setPending(action);
    try {
      const json = await request("PATCH", {
        id: detail.supplier.id,
        ...changes,
      });
      setDetail((current) =>
        current ? { ...current, supplier: json.supplier } : current,
      );
      await load();
      window.dispatchEvent(new Event("crm:supplier-profiles-updated"));
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save supplier.",
      );
      return false;
    } finally {
      setPending(null);
    }
  };
  const toggleTag = async (tagId: string) => {
    if (!detail) return;
    const selected = detail.tags.some((tag) => tag.id === tagId);
    const option = detail.tagOptions.find((tag) => tag.id === tagId);
    if (!selected && !option) return;
    const previous = detail.tags;
    setDetail({
      ...detail,
      tags: selected
        ? detail.tags.filter((tag) => tag.id !== tagId)
        : [...detail.tags, option!].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    });
    try {
      await request("PATCH", {
        action: "toggle-supplier-tag",
        supplierId: detail.supplier.id,
        tagId,
        selected: !selected,
      });
    } catch (error) {
      setDetail((current) => current ? { ...current, tags: previous } : current);
      toast.error(error instanceof Error ? error.message : "Could not update tags.");
    }
  };
  const addTagOption = async (event: React.FormEvent) => {
    event.preventDefault(); if (!newTag.trim()) return; setPending("add-tag");
    try {
      const json = await request("POST", { action: "tag-option", name: newTag });
      setNewTag("");
      if (!detail) return;
      setDetail((current) => current ? {
        ...current,
        tagOptions: [...current.tagOptions, json.tagOption],
        tags: [...current.tags, json.tagOption].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
      } : current);
      await request("PATCH", {
        action: "toggle-supplier-tag",
        supplierId: detail.supplier.id,
        tagId: json.tagOption.id,
        selected: true,
      });
    }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not add tag."); }
    finally { setPending(null); }
  };
  const saveTagOption = async (id: string, changes: Record<string, unknown>) => {
    setPending(`tag:${id}`);
    try {
      await request("PATCH", { action: "tag-option", id, ...changes });
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update tag.");
    } finally {
      setPending(null);
    }
  };
  const deleteTagOption = async (tag: Tag) => {
    if (!window.confirm(`Delete the tag “${tag.name}”? It will be removed from every supplier profile.`)) return;
    setPending(`delete-tag:${tag.id}`);
    try {
      await request("DELETE", { action: "tag-option", id: tag.id });
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete tag.");
    } finally {
      setPending(null);
    }
  };
  const reorderTags = async (fromId: string, toId: string) => {
    if (!detail || fromId === toId) return;
    const ordered = [...detail.tagOptions];
    const from = ordered.findIndex((tag) => tag.id === fromId);
    const to = ordered.findIndex((tag) => tag.id === toId);
    if (from < 0 || to < 0) return;
    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    setDetail({ ...detail, tagOptions: ordered });
    setPending("reorder-tags");
    try {
      await request("PATCH", { action: "reorder-tag-options", tagIds: ordered.map((tag) => tag.id) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reorder tags.");
      await reload();
    } finally {
      setPending(null);
    }
  };
  const confirmDelete = async () => {
    if (!detail || !deleting) return;
    setPending("delete");
    try {
      const json = await request("DELETE", {
        action: deleting.kind,
        id: deleting.id,
        name: deleting.name,
        supplierId: detail.supplier.id,
      });
      if (deleting.kind === "supplier") {
        setDetail(null);
        await load();
        window.dispatchEvent(new Event("crm:supplier-profiles-updated"));
      } else if (deleting.kind === "remark")
        setDetail((current) =>
          current
            ? {
                ...current,
                remarks: current.remarks.filter(
                  (item) => item.id !== deleting.id,
                ),
              }
            : current,
        );
      else {
        await reload();
        if (json.activeCount)
          toast.info(
            `Removed from this profile; ${json.activeCount} matching CRM Board subitem${json.activeCount === 1 ? " remains" : "s remain"}.`,
          );
      }
      setDeleting(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete.");
    } finally {
      setPending(null);
    }
  };
  const openLeads = async (product: Product) => {
    if (!detail) return;
    setLeadsFor({ ...product, leads: undefined });
    setPending(`leads:${product.id}`);
    try {
      const response = await fetch(
        `/api/supplier-profiles?id=${detail.supplier.id}&productName=${encodeURIComponent(product.name)}`,
      );
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not load leads.");
      setLeadsFor({ ...product, leads: json.leads ?? [] });
    } catch (error) {
      setLeadsFor(null);
      toast.error(error instanceof Error ? error.message : "Could not load leads.");
    } finally {
      setPending(null);
    }
  };

  if (!detail) {
    const searchTerm = search.trim().toLowerCase();
    const filtered = suppliers
      .filter((supplier) => !searchTerm || [
        supplier.name,
        supplier.contact ?? "",
        ...(supplier.tags?.map((tag) => tag.name) ?? []),
        ...(supplier.productNames ?? []),
      ].some((value) => value.toLowerCase().includes(searchTerm)))
      .sort((left, right) => Number(Boolean(right.is_starred)) - Number(Boolean(left.is_starred)) || left.name.localeCompare(right.name));
    return (
      <section className="min-h-full bg-slate-50 p-5">
        <div className="mx-auto max-w-[1680px]">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">Supplier Profiles</h1>
              <p className="text-sm text-slate-500">
                Suppliers linked from CRM Board subitems.
              </p>
            </div>
          </div>
          <div className="mb-4 flex w-full gap-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, contact, tags, or subitems..."
              className="h-10 w-full max-w-2xl rounded border px-3 text-sm"
            />
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="ml-auto inline-flex shrink-0 items-center gap-1 rounded bg-amber-600 px-3 text-sm font-semibold text-white"
            >
              <Plus size={16} />
              Add supplier
            </button>
          </div>
          <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
            {filtered.length ? (
              filtered.map((supplier) => (
                <div
                  key={supplier.id}
                  className={`flex min-h-16 items-center gap-3 border-b p-3 last:border-b-0 ${supplier.is_blacklisted ? "bg-red-100" : supplier.is_starred ? "bg-amber-50" : "bg-white"}`}
                >
                  <div className="hidden">
                  {pending === `open:${supplier.id}` ? <LoaderCircle className="mb-2 animate-spin text-amber-600" size={20} /> : <Building2 className="mb-2 text-amber-600" size={20} />}
                  <p className="truncate font-semibold">{supplier.name}</p>
                  {pending === `open:${supplier.id}` && <p className="mt-1 text-xs text-slate-500">Opening profile…</p>}
                  {supplier.is_blacklisted && (
                    <p className="mt-1 text-xs font-semibold text-red-700">
                      Blacklisted
                    </p>
                  )}
                  </div>
                  <button type="button" aria-label={`${supplier.is_starred ? "Remove star from" : "Star"} ${supplier.name}`} onClick={() => void toggleListStar(supplier)} disabled={pending === `star:${supplier.id}`} className={`rounded p-2 ${supplier.is_starred ? "text-amber-500" : "text-slate-300 hover:bg-amber-50 hover:text-amber-500"}`}>
                    {pending === `star:${supplier.id}` ? <LoaderCircle className="animate-spin" size={19} /> : <Star size={19} fill={supplier.is_starred ? "currentColor" : "none"} />}
                  </button>
                  <button type="button" onClick={() => void open(supplier.id).catch((error) => toast.error(error.message))} disabled={pending === `open:${supplier.id}`} className="grid min-w-0 flex-1 grid-cols-[minmax(180px,1fr)_minmax(220px,1.2fr)_minmax(360px,2fr)] items-center gap-5 text-left">
                    <div className="min-w-0"><p className="truncate font-semibold">{supplier.name}</p>{supplier.is_blacklisted && <p className="mt-0.5 text-xs font-semibold text-red-700">Blacklisted</p>}</div>
                    <p className="truncate text-sm text-slate-600">{supplier.contact || "No contact details"}</p>
                    <div className="flex min-w-0 flex-wrap gap-1.5">{supplier.tags?.length ? supplier.tags.slice(0, 5).map((tag) => <span key={tag.id} style={{ backgroundColor: tag.color }} className="rounded-sm px-2 py-1 text-xs font-medium text-white">{tag.name}</span>) : <span className="text-sm text-slate-400">No tags</span>}{(supplier.tags?.length ?? 0) > 5 && <span className="self-center text-xs text-slate-500">+{supplier.tags!.length - 5}</span>}</div>
                  </button>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">
                <LoaderCircle className="mr-1 inline animate-spin" size={15} />
                No supplier profiles found.
              </p>
            )}
          </div>
          {createOpen && (
            <Dialog
              title="Create Supplier Profile"
              onClose={() => setCreateOpen(false)}
              className="max-w-[1500px] max-h-[calc(100vh-2rem)] overflow-y-auto md:min-h-[760px]"
            >
              <form onSubmit={createSupplier} className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
                <label className="block text-sm font-medium">Supplier Name
                  <input required autoFocus value={createDraft.name} onChange={(event) => setCreateDraft((current) => ({ ...current, name: event.target.value }))} className="mt-1.5 h-10 w-full rounded border px-3 text-sm" />
                </label>
                <label className="block text-sm font-medium">Supplier Contact
                  <textarea value={createDraft.contact} onChange={(event) => setCreateDraft((current) => ({ ...current, contact: event.target.value }))} placeholder="Contact person, phone, email, or other contact details" className="mt-1.5 min-h-20 w-full resize-y rounded border p-3 text-sm" />
                </label>
                <div className="md:col-span-2">
                  <p className="text-sm font-medium">Tags</p>
                  <div className="mt-2 flex min-h-10 flex-wrap content-start items-start gap-1.5">
                    {createDraft.tagIds.length ? listTagOptions
                      .filter((tag) => createDraft.tagIds.includes(tag.id))
                      .map((tag) => (
                        <span
                          key={tag.id}
                          style={{ backgroundColor: tag.color }}
                          className="rounded-sm px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
                        >
                          {tag.name}
                        </span>
                      )) : (
                      <span className="self-center text-sm text-slate-400">No tags selected.</span>
                    )}
                  </div>
                  <input value={createTagSearch} onChange={(event) => setCreateTagSearch(event.target.value)} placeholder="Search tags..." className="mt-1.5 h-9 w-full rounded border px-3 text-sm" />
                  <div className="mt-2 flex max-h-36 flex-wrap gap-1.5 overflow-y-auto p-1">
                    {listTagOptions.filter((tag) => tag.name.toLowerCase().includes(createTagSearch.toLowerCase())).map((tag) => {
                      const selected = createDraft.tagIds.includes(tag.id);
                      return <button key={tag.id} type="button" onClick={() => setCreateDraft((current) => ({ ...current, tagIds: selected ? current.tagIds.filter((id) => id !== tag.id) : [...current.tagIds, tag.id] }))} style={{ backgroundColor: tag.color }} className={`rounded-sm px-2.5 py-1.5 text-xs font-semibold text-white ${selected ? "ring-2 ring-slate-800 ring-offset-1" : "opacity-75 hover:opacity-100"}`}>{tag.name}</button>;
                    })}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm font-medium">Subitems sold</p>
                  <div className="mt-1.5 flex gap-2">
                    <input value={createProductInput} onChange={(event) => setCreateProductInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addDraftProduct(); } }} placeholder="Subitem name" className="h-9 min-w-0 flex-1 rounded border px-3 text-sm" />
                    <button type="button" onClick={addDraftProduct} className="rounded border border-amber-300 px-3 text-sm font-medium text-amber-700">Add</button>
                  </div>
                  {createDraft.productNames.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{createDraft.productNames.map((name) => <span key={name} className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs">{name}<button type="button" onClick={() => setCreateDraft((current) => ({ ...current, productNames: current.productNames.filter((item) => item !== name) }))} aria-label={`Remove ${name}`}><X size={13} /></button></span>)}</div>}
                </div>
                <div className="flex flex-wrap gap-2 md:col-span-2">
                  <button type="button" onClick={() => setCreateDraft((current) => ({ ...current, isStarred: !current.isStarred, isBlacklisted: current.isStarred ? current.isBlacklisted : false }))} className={`inline-flex items-center gap-1 rounded border px-3 py-2 text-sm ${createDraft.isStarred ? "border-amber-300 bg-amber-50 text-amber-700" : "text-slate-600"}`}><Star size={15} fill={createDraft.isStarred ? "currentColor" : "none"} /> Starred</button>
                  <button type="button" onClick={() => setCreateDraft((current) => ({ ...current, isBlacklisted: !current.isBlacklisted, isStarred: current.isBlacklisted ? current.isStarred : false }))} className={`rounded border px-3 py-2 text-sm ${createDraft.isBlacklisted ? "border-red-300 bg-red-50 text-red-700" : "text-slate-600"}`}>Blacklisted</button>
                </div>
                <div className="flex justify-end gap-2 border-t pt-4 md:col-span-2">
                  <button type="button" onClick={() => setCreateOpen(false)} className="rounded border px-4 py-2 text-sm">Cancel</button>
                  <button disabled={pending === "create-supplier"} className="rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{pending === "create-supplier" ? "Creating…" : "Create supplier"}</button>
                </div>
              </form>
            </Dialog>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-full bg-slate-50 p-5">
      <div className="mx-auto max-w-[1680px]">
        <button
          onClick={() => setDetail(null)}
          className="mb-4 inline-flex items-center gap-2 text-sm text-slate-600"
        >
          <ArrowLeft size={16} />
          Back to Supplier Profiles
        </button>
        <header className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-5 shadow-sm">
          <Building2 className="text-amber-600" size={25} />
          <input
            value={detail.supplier.name}
            onChange={(event) =>
              setDetail({
                ...detail,
                supplier: { ...detail.supplier, name: event.target.value },
              })
            }
            onBlur={() => void saveSupplier({ name: detail.supplier.name })}
            className="min-w-[280px] flex-1 text-xl font-semibold outline-none"
          />
          <button
            onClick={() => setBlacklistConfirm(true)}
            className="rounded border border-red-200 px-3 py-2 text-sm text-red-700"
            disabled={pending === "blacklist"}
          >
            {pending === "blacklist" ? "Saving…" : detail.supplier.is_blacklisted ? "Un-blacklist" : "Blacklist"}
          </button>
          <button onClick={() => void saveSupplier({ isStarred: !detail.supplier.is_starred })} disabled={pending === "star"} className={`inline-flex items-center gap-1 rounded border px-3 py-2 text-sm ${detail.supplier.is_starred ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-600"}`}>
            <Star size={15} fill={detail.supplier.is_starred ? "currentColor" : "none"} /> {detail.supplier.is_starred ? "Starred" : "Star"}
          </button>
          <button
            onClick={() =>
              setDeleting({
                kind: "supplier",
                id: detail.supplier.id,
                name: detail.supplier.name,
              })
            }
            className="inline-flex items-center gap-1 rounded border border-red-200 px-3 py-2 text-sm text-red-700"
          >
            <Trash2 size={15} />
            Delete profile
          </button>
        </header>
        <section className="mt-5 rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Supplier Contact</h2>
          <textarea value={detail.supplier.contact ?? ""} onChange={(event) => setDetail({ ...detail, supplier: { ...detail.supplier, contact: event.target.value } })} onBlur={() => void saveSupplier({ contact: detail.supplier.contact ?? "" })} placeholder="Contact person, phone, email, or other supplier contact details" className="mt-3 min-h-24 w-full resize-y rounded border p-3 text-sm" />
        </section>
        <section className="mt-5 rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Tags</h2>
              <p className="text-xs text-slate-500">Higher-level supplier product categories.</p>
            </div>
            <button type="button" onClick={() => { setTagSelectorOpen((open) => !open); setTagEditMode(false); }} className="rounded border border-amber-300 px-3 py-2 text-sm text-amber-700">
              {tagSelectorOpen ? "Close" : "Update tags"}
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2.5">
            {detail.tags.length ? detail.tags.map((tag) => (
              <span key={tag.id} style={{ backgroundColor: tag.color }} className="rounded-sm px-4 py-2 text-sm font-semibold text-white shadow-sm">{tag.name}</span>
            )) : <span className="text-sm text-slate-400">No tags selected.</span>}
          </div>
          {tagSelectorOpen && (
            <div className="mt-5 rounded border bg-slate-50 p-4">
              {!tagEditMode ? (
                <>
                  <input value={tagSearch} onChange={(event) => setTagSearch(event.target.value)} placeholder="Search tags..." className="h-11 w-full rounded border px-3 text-base" />
                  <div className="mt-4 flex max-h-72 flex-wrap gap-2.5 overflow-y-auto p-1.5 pr-3">
                    {detail.tagOptions.filter((tag) => tag.name.toLowerCase().includes(tagSearch.toLowerCase())).map((tag) => {
                      const selected = detail.tags.some((item) => item.id === tag.id);
                      return <button key={tag.id} type="button" onClick={() => void toggleTag(tag.id)} style={{ backgroundColor: tag.color }} className={`rounded-sm px-4 py-2 text-sm font-semibold text-white shadow-sm transition ${selected ? "ring-2 ring-slate-800 ring-offset-2" : "hover:ring-2 hover:ring-slate-300 hover:ring-offset-1"}`}>{tag.name}</button>;
                    })}
                  </div>
                  <div className="mt-5 border-t pt-4">
                    <button type="button" onClick={() => setTagEditMode(true)} className="rounded border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-700">Edit tags</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-slate-600">Drag tags to change their order. Changes apply to every supplier profile.</p>
                    <button type="button" onClick={() => setTagEditMode(false)} className="text-sm font-medium text-amber-700">Done</button>
                  </div>
                  <input value={tagSearch} onChange={(event) => setTagSearch(event.target.value)} placeholder="Find a tag to edit..." className="mb-3 h-9 w-full rounded border px-3 text-sm" />
                  <div className="grid max-h-80 grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2 overflow-y-auto pr-2">
                    {detail.tagOptions.filter((tag) => tag.name.toLowerCase().includes(tagSearch.toLowerCase())).map((tag) => (
                      <div key={tag.id} draggable={!tagSearch.trim()} onDragStart={() => { if (!tagSearch.trim()) setDraggedTagId(tag.id); }} onDragOver={(event) => { if (!tagSearch.trim()) event.preventDefault(); }} onDrop={() => { if (!tagSearch.trim() && draggedTagId) void reorderTags(draggedTagId, tag.id); setDraggedTagId(null); }} className="flex items-center gap-1.5 rounded border bg-white p-1.5">
                        <GripVertical size={16} className={`shrink-0 ${tagSearch.trim() ? "cursor-not-allowed text-slate-200" : "cursor-grab text-slate-400"}`} />
                        <input type="color" value={tag.color} onChange={(event) => void saveTagOption(tag.id, { color: event.target.value })} className="h-7 w-8 shrink-0 cursor-pointer rounded border p-0.5" aria-label={`Colour for ${tag.name}`} />
                        <input defaultValue={tag.name} onBlur={(event) => { const name = event.target.value.trim(); if (name && name !== tag.name) void saveTagOption(tag.id, { name }); }} className="h-7 min-w-0 flex-1 rounded border px-1.5 text-xs" />
                        <button type="button" onClick={() => void deleteTagOption(tag)} disabled={pending === `delete-tag:${tag.id}`} className="rounded p-2 text-red-600 hover:bg-red-50" aria-label={`Delete ${tag.name}`}><Trash2 size={16} /></button>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={addTagOption} className="mt-4 flex gap-2 border-t pt-4">
                    <input value={newTag} onChange={(event) => setNewTag(event.target.value)} placeholder="New tag name" className="h-10 min-w-0 flex-1 rounded border px-3 text-sm" />
                    <button disabled={pending === "add-tag"} className="inline-flex items-center gap-1 rounded bg-amber-600 px-4 text-sm font-semibold text-white disabled:opacity-60"><Plus size={16} />{pending === "add-tag" ? "Adding…" : "Add tag"}</button>
                  </form>
                </>
              )}
            </div>
          )}
        </section>
        <div className="mt-5 grid items-start gap-5 xl:grid-cols-2">
          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Subitems sold</h2>
                <p className="text-xs text-slate-500">
                  Same names are combined. Click a row to view every lead.
                </p>
              </div>
              <form onSubmit={addProduct} className="flex gap-2">
                <input
                  value={productName}
                  onChange={(event) => setProductName(event.target.value)}
                  placeholder="Subitem name"
                  className="h-9 rounded border px-2 text-sm"
                />
                <button disabled={pending === "add-product"} className="rounded bg-amber-600 px-3 text-sm font-semibold text-white disabled:opacity-60">
                  {pending === "add-product" ? "Adding…" : "Add"}
                </button>
              </form>
            </div>
            <div className="mt-4 divide-y rounded border">
              {detail.products.length ? (
                detail.products.map((product) => (
                  <div key={product.id} className="flex items-center gap-2 p-3">
                    <button
                      onClick={() => void openLeads(product)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate font-medium hover:text-amber-700">
                        {product.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {product.subitemCount
                          ? `${product.subitemCount} on CRM Board`
                          : "Manual entry"}
                      </p>
                    </button>
                    <button
                      onClick={() => void openLeads(product)}
                      title="View leads"
                      className="rounded p-2 text-slate-500 hover:bg-slate-100"
                      disabled={pending === `leads:${product.id}`}
                    >
                      {pending === `leads:${product.id}` ? <LoaderCircle className="animate-spin" size={16} /> : <Users size={16} />}
                    </button>
                    <button
                      onClick={() =>
                        setDeleting({
                          kind: "product",
                          id: product.id,
                          name: product.name,
                          activeCount: product.subitemCount,
                        })
                      }
                      className="rounded p-2 text-red-600 hover:bg-red-50"
                      disabled={pending !== null}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              ) : (
                <p className="p-6 text-center text-sm text-slate-400">
                  No subitems listed.
                </p>
              )}
            </div>
          </section>
          <section className="rounded-xl border bg-white shadow-sm">
            <header className="border-b p-5">
              <h2 className="font-semibold">Remarks</h2>
            </header>
            <form onSubmit={addRemark} className="border-b p-4">
              <textarea
                value={remark}
                onChange={(event) => setRemark(event.target.value)}
                placeholder="Write a remark..."
                className="min-h-28 w-full resize-y rounded border p-3 text-sm"
              />
              <button disabled={pending === "add-remark"} className="mt-2 ml-auto flex items-center gap-1 rounded bg-amber-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
                <Send size={15} />
                {pending === "add-remark" ? "Posting…" : "Post remark"}
              </button>
            </form>
            <div className="divide-y">
              {detail.remarks.length ? (
                detail.remarks.map((item) => (
                  <article key={item.id} className="flex gap-2 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-wrap text-sm">
                        {item.content}
                      </p>
                      <p className="mt-2 text-xs text-slate-400">
                        {item.author?.full_name ?? item.author?.email ?? "User"}{" "}
                        · {new Date(item.created_at).toLocaleString("en-SG")}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        setDeleting({ kind: "remark", id: item.id })
                      }
                      className="h-fit rounded p-2 text-red-600 hover:bg-red-50"
                      disabled={pending !== null}
                    >
                      <Trash2 size={15} />
                    </button>
                  </article>
                ))
              ) : (
                <p className="p-6 text-center text-sm text-slate-400">
                  No remarks yet.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
      {leadsFor && (
        <Dialog title={leadsFor.name} onClose={() => setLeadsFor(null)}>
          <p className="mb-3 text-sm text-slate-500">
            Leads with this subitem for {detail.supplier.name}
          </p>
              {leadsFor.leads === undefined ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  <LoaderCircle className="mr-1 inline animate-spin" size={15} />
                  Loading leads…
                </p>
              ) : leadsFor.leads.length ? (
            <div className="divide-y rounded border">
              {leadsFor.leads.map((lead) => (
                <div key={lead.id} className="p-3">
                  <p className="font-medium">{lead.name || "Unnamed lead"}</p>
                  <p className="text-xs text-slate-500">
                    {lead.display_id ?? lead.id}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-slate-500">
              This manual entry is not currently used on the CRM Board.
            </p>
          )}
        </Dialog>
      )}
      {deleting && (
        <Dialog
          title={
            deleting.kind === "supplier"
              ? "Delete supplier profile?"
              : deleting.kind === "remark"
                ? "Delete remark?"
                : "Remove subitem from this profile?"
          }
          onClose={() => setDeleting(null)}
        >
          <p className="text-sm text-slate-600">
            {deleting.kind === "supplier"
              ? "This permanently deletes the profile and remarks. CRM Board subitems are not deleted, but will no longer be linked to this profile."
              : deleting.kind === "remark"
                ? "This remark will be permanently deleted."
                : deleting.activeCount
                  ? `This only removes “${deleting.name}” from this profile. It does not delete the ${deleting.activeCount} matching subitem${deleting.activeCount === 1 ? "" : "s"} still on the CRM Board.`
                  : `Remove “${deleting.name}” from this profile?`}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setDeleting(null)}
              className="rounded border px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={() => void confirmDelete()}
              disabled={pending === "delete"}
              className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white"
            >
              {pending === "delete" ? "Deleting…" : "Delete"}
            </button>
          </div>
        </Dialog>
      )}
      {blacklistConfirm && (
        <Dialog
          title={
            detail.supplier.is_blacklisted
              ? "Remove supplier blacklist?"
              : "Blacklist supplier?"
          }
          onClose={() => setBlacklistConfirm(false)}
        >
          <p className="text-sm text-slate-600">
            {detail.supplier.is_blacklisted
              ? `Remove “${detail.supplier.name}” from the blacklist? Its Supplier and linked subitem name fields will return to their normal appearance.`
              : `Blacklist “${detail.supplier.name}”? Its Supplier cell and linked subitem name fields will be clearly highlighted in red on the CRM Board.`}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setBlacklistConfirm(false)}
              disabled={pending === "blacklist"}
              className="rounded border px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                void saveSupplier({
                  isBlacklisted: !detail.supplier.is_blacklisted,
                }).then((saved) => {
                  if (saved) setBlacklistConfirm(false);
                });
              }}
              disabled={pending === "blacklist"}
              className={`rounded px-4 py-2 text-sm font-semibold text-white ${detail.supplier.is_blacklisted ? "bg-emerald-600" : "bg-red-600"}`}
            >
              {pending === "blacklist"
                ? "Saving…"
                : detail.supplier.is_blacklisted
                  ? "Remove blacklist"
                  : "Blacklist supplier"}
            </button>
          </div>
        </Dialog>
      )}
    </section>
  );
}

function Dialog({
  title,
  children,
  onClose,
  className,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  className?: string;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/40 p-4">
      <section className={`w-full rounded-xl bg-white p-5 shadow-2xl ${className ?? "max-w-xl"}`}>
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded p-2 hover:bg-slate-100">
            <X size={18} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
