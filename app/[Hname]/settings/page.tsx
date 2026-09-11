"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { PageLayout } from "../../../components/page-layout";
import { PencilIcon, TrashBinIcon, PlusIcon } from "../../../components/icons";
import { getAssignablePages, PAGE_GROUPS } from "../../../lib/page-registry";
import type { PageEntry } from "../../../lib/page-registry";

type RoleRow = {
  id: number;
  name: string;
  description: string | null;
  user_count: number;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const assignablePages = getAssignablePages();

// ── Tab types ────────────────────────────────────────────────────────────────
type Tab = "roles" | "permissions";

// ── Settings Page ─────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const params = useParams();
  const hname = decodeURIComponent((params?.Hname as string) ?? "");
  const [activeTab, setActiveTab] = useState<Tab>("roles");

  return (
    <PageLayout title="Settings">
      <div className="mx-auto max-w-6xl">
        {/* Page header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white/90">
            Settings
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage roles, permissions and access control for your hospital.
          </p>
        </div>

        {/* Tab bar */}
        <div className="mb-6 flex gap-1 rounded-2xl bg-gray-100 p-1.5 dark:bg-gray-800 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab("roles")}
            className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${activeTab === "roles"
              ? "bg-white text-gray-900 shadow dark:bg-gray-700 dark:text-white"
              : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              }`}
          >
            Roles
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("permissions")}
            className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${activeTab === "permissions"
              ? "bg-white text-gray-900 shadow dark:bg-gray-700 dark:text-white"
              : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              }`}
          >
            Role Permissions
          </button>
        </div>

        {/* Tab content */}
        {activeTab === "roles" && <RolesTab hname={hname} />}
        {activeTab === "permissions" && <PermissionsTab hname={hname} />}
      </div>
    </PageLayout>
  );
}

// ── Roles Tab ─────────────────────────────────────────────────────────────────
function RolesTab({ hname }: { hname: string }) {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadRoles = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/${encodeURIComponent(hname)}/roles`, { cache: "no-store" });
      const data = (await res.json()) as { roles?: RoleRow[] };
      setRoles(data.roles ?? []);
    } catch {
      setError("Failed to load roles.");
    } finally {
      setIsLoading(false);
    }
  }, [hname]);

  useEffect(() => { void loadRoles(); }, [loadRoles]);

  async function saveRole() {
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/${encodeURIComponent(hname)}/roles`, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, name: form.name, description: form.description }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to save role.");
      setMessage(editingId ? "Role updated." : "Role created.");
      setForm({ name: "", description: "" });
      setEditingId(null);
      setShowForm(false);
      await loadRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save role.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteRole(id: number) {
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/${encodeURIComponent(hname)}/roles`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to delete role.");
      setMessage("Role deleted.");
      await loadRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete role.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-white/90">Roles</h3>
            <p className="mt-0.5 text-sm text-gray-500">
              Create named roles to group access permissions.
            </p>
          </div>
          {!showForm && (
            <button
              type="button"
              onClick={() => { setShowForm(true); setEditingId(null); setForm({ name: "", description: "" }); setError(null); setMessage(null); }}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
            >
              <PlusIcon className="h-4 w-4" />
              New Role
            </button>
          )}
        </div>

        {/* Form */}
        {showForm && (
          <div className="border-b border-gray-100 bg-gray-50 px-6 py-5 dark:border-gray-800 dark:bg-gray-800/30">
            <h4 className="mb-4 text-sm font-medium text-gray-700 dark:text-gray-300">
              {editingId ? "Edit Role" : "Create New Role"}
            </h4>
            <div className="flex flex-wrap gap-4">
              <div className="w-full max-w-xs">
                <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">
                  Role Name <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., Receptionist"
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                  required
                />
              </div>
              <div className="w-full max-w-sm">
                <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">
                  Description
                </label>
                <input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description"
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void saveRole()}
                className="inline-flex items-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
              >
                {isSubmitting ? "Saving..." : editingId ? "Update Role" : "Create Role"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingId(null); setForm({ name: "", description: "" }); }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
          </div>
        )}

        {message && !showForm && (
          <div className="border-b border-green-100 bg-green-50 px-6 py-3 dark:border-green-900/30 dark:bg-green-900/10">
            <p className="text-sm text-green-700 dark:text-green-400">{message}</p>
          </div>
        )}
        {error && !showForm && (
          <div className="border-b border-red-100 bg-red-50 px-6 py-3 dark:border-red-900/30 dark:bg-red-900/10">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Roles list */}
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {isLoading ? (
            <div className="px-6 py-8 text-center text-sm text-gray-500">Loading roles...</div>
          ) : roles.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No roles created yet</p>
              <p className="mt-1 text-xs text-gray-400">Click "New Role" to create the first role.</p>
            </div>
          ) : (
            roles.map((role) => (
              <div key={role.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-800 dark:text-white/90">{role.name}</span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      {role.user_count} {role.user_count === 1 ? "user" : "users"}
                    </span>
                  </div>
                  {role.description && (
                    <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{role.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(role.id);
                      setForm({ name: role.name, description: role.description ?? "" });
                      setShowForm(true);
                      setError(null);
                      setMessage(null);
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
                  >
                    <PencilIcon className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteRole(role.id)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-100 bg-white text-red-500 transition hover:bg-red-50 hover:text-red-600 dark:border-red-900/40 dark:bg-gray-900 dark:text-red-400 dark:hover:bg-red-950/30"
                    title="Delete role"
                  >
                    <TrashBinIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Permissions Tab ───────────────────────────────────────────────────────────
function PermissionsTab({ hname }: { hname: string }) {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [isLoadingPerms, setIsLoadingPerms] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(PAGE_GROUPS));

  const loadRoles = useCallback(async () => {
    setIsLoadingRoles(true);
    try {
      const res = await fetch(`/api/${encodeURIComponent(hname)}/roles`, { cache: "no-store" });
      const data = (await res.json()) as { roles?: RoleRow[] };
      setRoles(data.roles ?? []);
    } catch {
      setError("Failed to load roles.");
    } finally {
      setIsLoadingRoles(false);
    }
  }, [hname]);

  useEffect(() => { void loadRoles(); }, [loadRoles]);

  const loadPermissions = useCallback(async (roleId: number) => {
    setIsLoadingPerms(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/${encodeURIComponent(hname)}/roles/${roleId}/permissions`);
      const data = (await res.json()) as { pageKeys?: string[] };
      setPermissions(new Set(data.pageKeys ?? []));
    } catch {
      setError("Failed to load permissions.");
    } finally {
      setIsLoadingPerms(false);
    }
  }, [hname]);

  useEffect(() => {
    if (selectedRoleId) {
      void loadPermissions(selectedRoleId);
    } else {
      setPermissions(new Set());
    }
  }, [selectedRoleId, loadPermissions]);

  const togglePage = (key: string) => {
    setPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleGroup = (group: string, pages: Record<string, PageEntry[]>) => {
    const allKeys = Object.values(pages).flat().map((p) => p.key);
    const allSelected = allKeys.every((k) => permissions.has(k));

    setPermissions((prev) => {
      const next = new Set(prev);
      for (const key of allKeys) {
        if (allSelected) next.delete(key);
        else next.add(key);
      }
      return next;
    });
  };

  const toggleSubgroup = (subPages: PageEntry[]) => {
    const allSelected = subPages.every((p) => permissions.has(p.key));
    setPermissions((prev) => {
      const next = new Set(prev);
      for (const page of subPages) {
        if (allSelected) next.delete(page.key);
        else next.add(page.key);
      }
      return next;
    });
  };

  async function savePermissions() {
    if (!selectedRoleId) return;
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/${encodeURIComponent(hname)}/roles/${selectedRoleId}/permissions`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageKeys: [...permissions] }),
        }
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to save.");
      setMessage("Permissions saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setIsSaving(false);
    }
  }

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <h3 className="font-semibold text-gray-800 dark:text-white/90">Role Permissions</h3>
          <p className="mt-0.5 text-sm text-gray-500">
            Select a role and configure which pages its users can access.
          </p>
        </div>

        <div className="px-6 py-5">
          {/* Role selector */}
          <div className="mb-6 max-w-xs">
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
              Select Role
            </label>
            {isLoadingRoles ? (
              <div className="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
            ) : roles.length === 0 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/10 dark:text-amber-400">
                No roles yet. Create roles in the Roles tab first.
              </p>
            ) : (
              <div className="relative">
                <select
                  value={selectedRoleId ?? ""}
                  onChange={(e) => setSelectedRoleId(e.target.value ? Number(e.target.value) : null)}
                  className="h-10 w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 pr-8 text-sm text-gray-800 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                >
                  <option value="">-- Select a role --</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <svg className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            )}
          </div>

          {/* Permissions tree */}
          {selectedRole && (
            <>
              {isLoadingPerms ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                      Configure pages for <span className="font-semibold text-gray-800 dark:text-white/80">{selectedRole.name}</span>
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPermissions(new Set(
                          Object.values(assignablePages).flatMap((subs) =>
                            Object.values(subs).flat().map((p) => p.key)
                          )
                        ))}
                        className="text-xs text-brand-500 hover:underline"
                      >
                        Select All
                      </button>
                      <span className="text-gray-300 dark:text-gray-600">|</span>
                      <button
                        type="button"
                        onClick={() => setPermissions(new Set())}
                        className="text-xs text-gray-500 hover:underline"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  {/* Group accordions */}
                  {PAGE_GROUPS.filter((g) => assignablePages[g]).map((group) => {
                    const subgroups = assignablePages[group];
                    const allGroupPages = Object.values(subgroups).flat();
                    const checkedCount = allGroupPages.filter((p) => permissions.has(p.key)).length;
                    const isGroupOpen = expandedGroups.has(group);

                    return (
                      <div key={group} className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                        {/* Group header */}
                        <div className="flex items-center gap-3 bg-gray-50 px-4 py-3 dark:bg-gray-800/50">
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedGroups((prev) => {
                                const next = new Set(prev);
                                if (next.has(group)) next.delete(group);
                                else next.add(group);
                                return next;
                              });
                            }}
                            className="flex flex-1 items-center gap-2 text-left"
                          >
                            <svg
                              className={`h-4 w-4 text-gray-400 transition-transform ${isGroupOpen ? "rotate-90" : ""}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{group}</span>
                            <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs text-gray-500 shadow-sm dark:bg-gray-700 dark:text-gray-400">
                              {checkedCount}/{allGroupPages.length}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleGroup(group, subgroups)}
                            className="shrink-0 rounded px-2 py-1 text-xs text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20"
                          >
                            {checkedCount === allGroupPages.length ? "Deselect All" : "Select All"}
                          </button>
                        </div>

                        {/* Pages */}
                        {isGroupOpen && (
                          <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
                            {Object.entries(subgroups).map(([subgroup, pages]) => (
                              <div key={subgroup} className="px-4 py-3">
                                {subgroup !== "__root__" && (
                                  <div className="mb-2 flex items-center justify-between">
                                    <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                                      {subgroup}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => toggleSubgroup(pages)}
                                      className="text-xs text-brand-500 hover:underline"
                                    >
                                      {pages.every((p) => permissions.has(p.key)) ? "Deselect" : "Select All"}
                                    </button>
                                  </div>
                                )}
                                <div className="grid grid-cols-1 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                                  {pages.map((page) => (
                                    <label
                                      key={page.key}
                                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/30"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={permissions.has(page.key)}
                                        onChange={() => togglePage(page.key)}
                                        className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                                      />
                                      <span className="text-sm text-gray-700 dark:text-gray-300">{page.label}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Save bar */}
                  <div className="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-800">
                    <div>
                      {message && <p className="text-sm text-green-600 dark:text-green-400">{message}</p>}
                      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                    </div>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => void savePermissions()}
                      className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/25 disabled:opacity-50"
                    >
                      {isSaving ? "Saving..." : "Save Permissions"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
