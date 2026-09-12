"use client";

import { useCallback, useEffect, useState } from "react";
import { SuperAdminShell } from "../../../components/super-admin/SuperAdminShell";
import { PAGE_REGISTRY, PAGE_GROUPS, getAssignablePages } from "../../../lib/page-registry";
import type { PageEntry } from "../../../lib/page-registry";

// ─── Types ────────────────────────────────────────────────────────────────────

type TenantRow = {
  id: number;
  hospital_name: string;
  admin_mail: string;
  creator_name: string;
  site_name: string;
  phone_number: string;
  country: string | null;
  timezone: string;
  currency_code: string;
  currency_name: string;
  currency_symbol: string;
  created_at: string;
  is_enabled: boolean;
  max_users: number | null;
  notes: string | null;
  feature_gate_count: number;
};

type PageGroupRow = {
  id: number;
  name: string;
  description: string | null;
  page_keys: string[];
};

const assignablePages = getAssignablePages();
const allAssignablePageKeys = PAGE_REGISTRY.filter((p) => !p.isAdminOnly).map((p) => p.key);

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className={`rounded-2xl border ${color} bg-white/[0.02] px-5 py-4`}>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="mt-0.5 text-xs text-slate-400">{label}</div>
    </div>
  );
}

// ─── Page Checklist ───────────────────────────────────────────────────────────
function FeatureChecklist({
  selected,
  onChange,
  pageGroups,
}: {
  selected: Set<string>;
  onChange: (keys: Set<string>) => void;
  pageGroups: PageGroupRow[];
}) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(PAGE_GROUPS.slice(0, 3)));

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

  const applyPageGroup = (group: PageGroupRow) => {
    const next = new Set(selected);
    for (const key of group.page_keys) next.add(key);
    onChange(next);
  };

  const toggleGroupExpand = (group: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const isFullAccess = selected.size === 0 || selected.size === allAssignablePageKeys.length;

  return (
    <div className="space-y-3">
      {/* Full access toggle */}
      <div className="flex items-center gap-3 rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-3">
        <input
          type="checkbox"
          id="full-access"
          checked={selected.size === 0}
          onChange={(e) => onChange(e.target.checked ? new Set() : new Set(allAssignablePageKeys))}
          className="h-4 w-4 rounded border-violet-500/30 bg-violet-500/10 text-violet-500 focus:ring-violet-500"
        />
        <label htmlFor="full-access" className="cursor-pointer">
          <div className="text-sm font-medium text-violet-300">Full Access (all pages)</div>
          <div className="text-xs text-slate-500">Leave unchecked to restrict to specific pages</div>
        </label>
      </div>

      {/* Only show checklist if not full access */}
      {selected.size > 0 && (
        <>
          {/* Page group quick-apply */}
          {pageGroups.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className="mb-2 text-xs font-medium text-slate-400">Quick-apply page groups:</div>
              <div className="flex flex-wrap gap-2">
                {pageGroups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => applyPageGroup(group)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-400 hover:bg-violet-500/20 transition"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    {group.name}
                    <span className="text-slate-500">({group.page_keys.length})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {PAGE_GROUPS.filter((g) => assignablePages[g]).map((group) => {
              const subgroups = assignablePages[group];
              const allGroupPages = Object.values(subgroups).flat();
              const checkedCount = allGroupPages.filter((p) => selected.has(p.key)).length;
              const isOpen = expandedGroups.has(group);

              return (
                <div key={group} className="rounded-xl border border-white/10 overflow-hidden">
                  <div className="flex items-center gap-2 bg-white/5 px-3 py-2">
                    <button type="button" onClick={() => toggleGroupExpand(group)}
                      className="flex flex-1 items-center gap-2 text-left">
                      <svg className={`h-3.5 w-3.5 text-slate-500 transition-transform ${isOpen ? "rotate-90" : ""}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="text-sm font-medium text-slate-200">{group}</span>
                      <span className="ml-auto text-xs text-slate-500">{checkedCount}/{allGroupPages.length}</span>
                    </button>
                    <button type="button" onClick={() => toggleGroup(allGroupPages)}
                      className="shrink-0 text-xs text-violet-400 hover:underline">
                      {checkedCount === allGroupPages.length ? "Deselect" : "All"}
                    </button>
                  </div>
                  {isOpen && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-0.5 px-3 py-2">
                      {allGroupPages.map((page) => (
                        <label key={page.key}
                          className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-white/5">
                          <input
                            type="checkbox"
                            checked={selected.has(page.key)}
                            onChange={() => toggle(page.key)}
                            className="h-3.5 w-3.5 rounded border-white/20 bg-white/10 text-violet-500 focus:ring-violet-500"
                          />
                          <span className="text-xs text-slate-300">{page.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{selected.size} of {allAssignablePageKeys.length} pages selected</span>
            <div className="flex gap-3">
              <button type="button" onClick={() => onChange(new Set(allAssignablePageKeys))}
                className="text-violet-400 hover:underline">Select All</button>
              <button type="button" onClick={() => onChange(new Set(allAssignablePageKeys))}
                className="text-slate-500 hover:underline" hidden>|</button>
              <button type="button" onClick={() => onChange(new Set())}
                className="text-slate-500 hover:underline">Full Access</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Create Tenant Modal ──────────────────────────────────────────────────────
function CreateTenantModal({
  onClose,
  onCreated,
  pageGroups,
}: {
  onClose: () => void;
  onCreated: () => void;
  pageGroups: PageGroupRow[];
}) {
  const [form, setForm] = useState({
    hospitalName: "",
    adminMail: "",
    password: "",
    siteName: "",
    phoneNumber: "",
    country: "",
    timezone: "Asia/Kolkata",
    maxUsers: "",
    notes: "",
  });
  const [featureKeys, setFeatureKeys] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (field: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  async function submit() {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/super-admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hospitalName: form.hospitalName,
          adminMail: form.adminMail,
          password: form.password,
          siteName: form.siteName,
          phoneNumber: form.phoneNumber,
          country: form.country || null,
          timezone: form.timezone,
          maxUsers: form.maxUsers ? parseInt(form.maxUsers, 10) : null,
          notes: form.notes || null,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; siteName?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to create tenant");

      // Set feature gates if restricted
      if (featureKeys.size > 0 && data.siteName) {
        await fetch(`/api/super-admin/tenants/${encodeURIComponent(data.siteName)}/features`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageKeys: [...featureKeys] }),
        });
      }

      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="my-8 w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Create New Tenant</h2>
          <button type="button" onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: "Hospital Name *", field: "hospitalName" as const, placeholder: "City General Hospital" },
              { label: "Site Name (URL) *", field: "siteName" as const, placeholder: "city-general" },
              { label: "Admin Email *", field: "adminMail" as const, placeholder: "admin@cityhospital.com" },
              { label: "Admin Password *", field: "password" as const, placeholder: "Secure password", type: "password" },
              { label: "Phone Number", field: "phoneNumber" as const, placeholder: "+1 234 567 8900" },
              { label: "Country", field: "country" as const, placeholder: "India" },
            ].map(({ label, field, placeholder, type }) => (
              <div key={field}>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">{label}</label>
                <input
                  type={type ?? "text"}
                  value={form[field]}
                  onChange={(e) => update(field, e.target.value)}
                  placeholder={placeholder}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                />
              </div>
            ))}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Max Users</label>
              <input
                type="number"
                min={1}
                value={form.maxUsers}
                onChange={(e) => update("maxUsers", e.target.value)}
                placeholder="Unlimited"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Notes</label>
              <input
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                placeholder="Internal notes"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
            </div>
          </div>

          {/* Feature gates */}
          <div>
            <label className="mb-2 block text-xs font-medium text-slate-400">Feature Access</label>
            <FeatureChecklist selected={featureKeys} onChange={setFeatureKeys} pageGroups={pageGroups} />
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-white transition">
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting || !form.hospitalName || !form.siteName || !form.adminMail || !form.password}
            onClick={() => void submit()}
            className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 transition">
            {isSubmitting ? "Creating..." : "Create Tenant"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tenant Feature Edit Panel ────────────────────────────────────────────────
function TenantFeaturesPanel({
  tenant,
  pageGroups,
  onClose,
}: {
  tenant: TenantRow;
  pageGroups: PageGroupRow[];
  onClose: () => void;
}) {
  const [featureKeys, setFeatureKeys] = useState<Set<string>>(new Set());
  const [maxUsers, setMaxUsers] = useState<string>(tenant.max_users?.toString() ?? "");
  const [notes, setNotes] = useState(tenant.notes ?? "");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/super-admin/tenants/${encodeURIComponent(tenant.site_name)}/features`);
        const data = (await res.json()) as { pageKeys?: string[] };
        setFeatureKeys(new Set(data.pageKeys ?? []));
      } catch {
        setError("Failed to load feature gates.");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [tenant.site_name]);

  async function save() {
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const [featRes, settingsRes] = await Promise.all([
        fetch(`/api/super-admin/tenants/${encodeURIComponent(tenant.site_name)}/features`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageKeys: [...featureKeys] }),
        }),
        fetch(`/api/super-admin/tenants/${encodeURIComponent(tenant.site_name)}/settings`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            is_enabled: tenant.is_enabled,
            max_users: maxUsers ? parseInt(maxUsers, 10) : null,
            notes: notes || null,
          }),
        }),
      ]);

      if (!featRes.ok || !settingsRes.ok) throw new Error("Failed to save");
      setMessage("Saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-violet-500/20 bg-violet-500/[0.03] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-violet-300">
          Manage Features — {tenant.hospital_name}
        </h3>
        <button type="button" onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-white/5" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Settings row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Max Users (blank = unlimited)</label>
              <input
                type="number"
                min={1}
                value={maxUsers}
                onChange={(e) => setMaxUsers(e.target.value)}
                placeholder="Unlimited"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Notes</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal notes"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
            </div>
          </div>

          {/* Feature gates */}
          <div>
            <div className="mb-2 text-xs font-medium text-slate-400">Feature Access</div>
            <FeatureChecklist selected={featureKeys} onChange={setFeatureKeys} pageGroups={pageGroups} />
          </div>

          <div className="flex items-center justify-between border-t border-white/10 pt-4">
            <div>
              {message && <p className="text-sm text-green-400">{message}</p>}
              {error && <p className="text-sm text-red-400">{error}</p>}
            </div>
            <button type="button" disabled={isSaving} onClick={() => void save()}
              className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 transition">
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Tenants Page ─────────────────────────────────────────────────────────
export default function TenantsPage() {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [pageGroups, setPageGroups] = useState<PageGroupRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null);
  const [togglingTenant, setTogglingTenant] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [tenantsRes, groupsRes] = await Promise.all([
        fetch("/api/super-admin/tenants", { cache: "no-store" }),
        fetch("/api/super-admin/page-groups", { cache: "no-store" }),
      ]);
      const tenantsData = (await tenantsRes.json()) as { tenants?: TenantRow[] };
      const groupsData = (await groupsRes.json()) as { groups?: PageGroupRow[] };
      setTenants(tenantsData.tenants ?? []);
      setPageGroups(groupsData.groups ?? []);
    } catch {
      setError("Failed to load tenants.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  async function toggleEnabled(tenant: TenantRow) {
    setTogglingTenant(tenant.site_name);
    try {
      await fetch(`/api/super-admin/tenants/${encodeURIComponent(tenant.site_name)}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_enabled: !tenant.is_enabled,
          max_users: tenant.max_users,
          notes: tenant.notes,
        }),
      });
      await loadData();
    } catch {
      setError("Failed to update tenant status.");
    } finally {
      setTogglingTenant(null);
    }
  }

  const filtered = tenants.filter((t) =>
    t.hospital_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.site_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.admin_mail.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCount = tenants.filter((t) => t.is_enabled).length;
  const disabledCount = tenants.length - activeCount;

  return (
    <SuperAdminShell>
      <div className="min-h-screen bg-slate-950 px-6 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Tenants</h1>
            <p className="mt-1 text-sm text-slate-400">
              Manage hospital tenants, feature access, and account limits.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition shadow-lg shadow-violet-500/20"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Tenant
          </button>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total Tenants" value={tenants.length} color="border-white/10" />
          <StatCard label="Active" value={activeCount} color="border-green-500/20" />
          <StatCard label="Disabled" value={disabledCount} color="border-red-500/20" />
          <StatCard
            label="With Restrictions"
            value={tenants.filter((t) => t.feature_gate_count > 0).length}
            color="border-violet-500/20"
          />
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Search */}
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5">
          <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tenants by name, site, or email..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
          />
        </div>

        {/* Tenant list */}
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/5" />
            ))
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-16">
              <p className="text-sm text-slate-400">
                {searchQuery ? `No tenants matching "${searchQuery}"` : "No tenants yet."}
              </p>
            </div>
          ) : (
            filtered.map((tenant) => {
              const isExpanded = expandedTenant === tenant.site_name;
              const isToggling = togglingTenant === tenant.site_name;

              return (
                <div key={tenant.site_name}
                  className={`rounded-2xl border transition ${
                    tenant.is_enabled
                      ? "border-white/10 bg-white/[0.03]"
                      : "border-red-500/20 bg-red-500/[0.02]"
                  }`}
                >
                  {/* Row */}
                  <div className="flex flex-wrap items-center gap-4 px-5 py-4">
                    {/* Status dot */}
                    <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${tenant.is_enabled ? "bg-green-500" : "bg-red-500"}`} />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-white">{tenant.hospital_name}</span>
                        <span className="rounded-lg bg-white/5 px-2 py-0.5 font-mono text-xs text-slate-400">
                          /{tenant.site_name}
                        </span>
                        {!tenant.is_enabled && (
                          <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">
                            Suspended
                          </span>
                        )}
                        {tenant.feature_gate_count > 0 && (
                          <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-400">
                            {tenant.feature_gate_count} features restricted
                          </span>
                        )}
                        {tenant.max_users && (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400">
                            max {tenant.max_users} users
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span>{tenant.admin_mail}</span>
                        {tenant.country && <span>{tenant.country}</span>}
                        <span>Created {new Date(tenant.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Visit site */}
                      <a
                        href={`/${tenant.site_name}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-400 hover:bg-white/5 hover:text-white transition"
                        title="Open tenant site"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                      </a>

                      {/* Features panel toggle */}
                      <button
                        type="button"
                        onClick={() => setExpandedTenant(isExpanded ? null : tenant.site_name)}
                        className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition ${
                          isExpanded
                            ? "border-violet-500/50 bg-violet-500/20 text-violet-300"
                            : "border-white/10 text-slate-400 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                        </svg>
                        Features
                      </button>

                      {/* Enable/Disable toggle */}
                      <button
                        type="button"
                        disabled={isToggling}
                        onClick={() => void toggleEnabled(tenant)}
                        className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition disabled:opacity-50 ${
                          tenant.is_enabled
                            ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
                            : "border-green-500/30 text-green-400 hover:bg-green-500/10"
                        }`}
                      >
                        {isToggling ? "..." : tenant.is_enabled ? "Disable" : "Enable"}
                      </button>
                    </div>
                  </div>

                  {/* Expanded features panel */}
                  {isExpanded && (
                    <div className="border-t border-white/5 px-5 pb-5">
                      <TenantFeaturesPanel
                        tenant={tenant}
                        pageGroups={pageGroups}
                        onClose={() => setExpandedTenant(null)}
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Create modal */}
        {showCreateModal && (
          <CreateTenantModal
            onClose={() => setShowCreateModal(false)}
            onCreated={() => { void loadData(); }}
            pageGroups={pageGroups}
          />
        )}
      </div>
    </SuperAdminShell>
  );
}
