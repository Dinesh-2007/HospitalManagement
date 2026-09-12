"use client";

import { useCallback, useEffect, useState } from "react";
import { SuperAdminShell } from "../../../components/super-admin/SuperAdminShell";
import { PAGE_REGISTRY, PAGE_GROUPS, getAssignablePages } from "../../../lib/page-registry";
import type { PageEntry } from "../../../lib/page-registry";

type PageGroupRow = {
  id: number;
  name: string;
  description: string | null;
  page_keys: string[];
  created_at: string;
};

const assignablePages = getAssignablePages();

function PageChecklist({
  selected,
  onChange,
  readOnly = false,
}: {
  selected: Set<string>;
  onChange: (keys: Set<string>) => void;
  readOnly?: boolean;
}) {
  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  };

  const toggleGroup = (pages: PageEntry[]) => {
    const allKeys = pages.map((p) => p.key);
    const allSelected = allKeys.every((k) => selected.has(k));
    const next = new Set(selected);
    for (const k of allKeys) {
      if (allSelected) next.delete(k);
      else next.add(k);
    }
    onChange(next);
  };

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
      {PAGE_GROUPS.filter((g) => assignablePages[g]).map((group) => {
        const subgroups = assignablePages[group];
        const allGroupPages = Object.values(subgroups).flat();
        const checkedCount = allGroupPages.filter((p) => selected.has(p.key)).length;

        return (
          <div key={group} className="rounded-xl border border-white/10 overflow-hidden">
            <div className="flex items-center gap-2 bg-white/5 px-4 py-2.5">
              <span className="flex-1 text-sm font-semibold text-slate-200">{group}</span>
              <span className="text-xs text-slate-500">{checkedCount}/{allGroupPages.length}</span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => toggleGroup(allGroupPages)}
                  className="text-xs text-violet-400 hover:text-violet-300 hover:underline"
                >
                  {checkedCount === allGroupPages.length ? "Deselect All" : "Select All"}
                </button>
              )}
            </div>
            <div className="px-4 py-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1 gap-x-4">
                {allGroupPages.map((page) => (
                  <label
                    key={page.key}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1 ${readOnly ? "" : "cursor-pointer hover:bg-white/5"}`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(page.key)}
                      disabled={readOnly}
                      onChange={() => !readOnly && toggle(page.key)}
                      className="h-3.5 w-3.5 rounded border-white/20 bg-white/10 text-violet-500 focus:ring-violet-500"
                    />
                    <span className="text-sm text-slate-300">{page.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PageGroupsPage() {
  const [groups, setGroups] = useState<PageGroupRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PageGroupRow | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formPages, setFormPages] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/super-admin/page-groups", { cache: "no-store" });
      const data = (await res.json()) as { groups?: PageGroupRow[] };
      setGroups(data.groups ?? []);
    } catch {
      setError("Failed to load page groups.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadGroups(); }, [loadGroups]);

  function openCreate() {
    setEditingGroup(null);
    setFormName("");
    setFormDesc("");
    setFormPages(new Set());
    setError(null);
    setMessage(null);
    setShowForm(true);
  }

  function openEdit(group: PageGroupRow) {
    setEditingGroup(group);
    setFormName(group.name);
    setFormDesc(group.description ?? "");
    setFormPages(new Set(group.page_keys));
    setError(null);
    setMessage(null);
    setShowForm(true);
  }

  async function saveGroup() {
    setIsSubmitting(true);
    setError(null);
    try {
      const method = editingGroup ? "PUT" : "POST";
      const body = {
        id: editingGroup?.id,
        name: formName,
        description: formDesc,
        pageKeys: [...formPages],
      };
      const res = await fetch("/api/super-admin/page-groups", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      setMessage(editingGroup ? "Group updated." : "Group created.");
      setShowForm(false);
      await loadGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteGroup(id: number) {
    if (!confirm("Delete this page group?")) return;
    setError(null);
    try {
      const res = await fetch("/api/super-admin/page-groups", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Failed to delete");
      setMessage("Group deleted.");
      await loadGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  const totalPages = PAGE_REGISTRY.filter((p) => !p.isAdminOnly).length;

  return (
    <SuperAdminShell>
      <div className="min-h-screen bg-slate-950 px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Page Groups</h1>
            <p className="mt-1 text-sm text-slate-400">
              Create reusable bundles of pages. Apply them to tenants for quick feature assignment.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Group
          </button>
        </div>

        {message && (
          <div className="mb-6 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
            {message}
          </div>
        )}
        {error && !showForm && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Form modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">
                  {editingGroup ? "Edit Page Group" : "Create Page Group"}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">
                    Group Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., Outpatient Bundle"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">Description</label>
                  <input
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="Optional description"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>
              </div>

              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-400">
                    Pages ({formPages.size}/{totalPages} selected)
                  </label>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setFormPages(new Set(PAGE_REGISTRY.filter(p => !p.isAdminOnly).map(p => p.key)))}
                      className="text-xs text-violet-400 hover:underline">Select All</button>
                    <button type="button" onClick={() => setFormPages(new Set())}
                      className="text-xs text-slate-500 hover:underline">Clear</button>
                  </div>
                </div>
                <PageChecklist selected={formPages} onChange={setFormPages} />
              </div>

              {error && (
                <p className="mb-3 text-sm text-red-400">{error}</p>
              )}

              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowForm(false)}
                  className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-white transition">
                  Cancel
                </button>
                <button type="button" disabled={isSubmitting || !formName} onClick={() => void saveGroup()}
                  className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 transition">
                  {isSubmitting ? "Saving..." : editingGroup ? "Update Group" : "Create Group"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Groups grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-36 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-20">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
              <svg className="h-7 w-7 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-400">No page groups yet</p>
            <p className="mt-1 text-xs text-slate-600">Create bundles like &quot;Outpatient&quot; or &quot;Pharmacy&quot; for quick tenant assignment</p>
            <button type="button" onClick={openCreate}
              className="mt-4 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 transition">
              Create First Group
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((group) => (
              <div key={group.id}
                className="group relative rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:border-violet-500/30 transition">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate">{group.name}</h3>
                    {group.description && (
                      <p className="mt-0.5 text-xs text-slate-400 line-clamp-2">{group.description}</p>
                    )}
                  </div>
                  <div className="ml-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button type="button" onClick={() => openEdit(group)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    </button>
                    <button type="button" onClick={() => void deleteGroup(group.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-400">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <span className="inline-flex items-center rounded-lg bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-400">
                    {group.page_keys.length} pages
                  </span>
                  <span className="text-xs text-slate-600">
                    {new Date(group.created_at).toLocaleDateString()}
                  </span>
                </div>

                {/* Preview tags */}
                {group.page_keys.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {group.page_keys.slice(0, 4).map((key) => (
                      <span key={key} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-500 font-mono">
                        {key.split("/").pop()}
                      </span>
                    ))}
                    {group.page_keys.length > 4 && (
                      <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-500">
                        +{group.page_keys.length - 4} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </SuperAdminShell>
  );
}
