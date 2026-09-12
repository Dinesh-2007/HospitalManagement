"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { PageLayout } from "../../../components/page-layout";
import { PencilIcon, TrashBinIcon, ChevronDownIcon } from "../../../components/icons";
import { PAGE_REGISTRY } from "../../../lib/page-registry";
import type { PageEntry } from "../../../lib/page-registry";
import { useRBAC } from "../../../components/context/RBACContext";

type UserRow = {
  id: number;
  username: string;
  role: string;
  role_id: number | null;
  role_name: string | null;
  created_at?: string;
};

type RoleRow = {
  id: number;
  name: string;
  description: string | null;
};

type FormState = {
  username: string;
  password: string;
  role_id: number | "";
  role: string;
};

function emptyForm(): FormState {
  return {
    username: "",
    password: "",
    role_id: "",
    role: "User",
  };
}

// Group page entries by group for the override checkbox UI
function getPagesByGroup(pages: PageEntry[]) {
  const groups: Record<string, PageEntry[]> = {};
  for (const page of pages) {
    if (page.isAdminOnly) continue;
    if (!groups[page.group]) groups[page.group] = [];
    groups[page.group].push(page);
  }
  return groups;
}

export default function ManageUsersPage() {
  const params = useParams();
  const hname = decodeURIComponent((params?.Hname as string) ?? "");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isShowingForm, setIsShowingForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Override management
  const [overrideUserId, setOverrideUserId] = useState<number | null>(null);
  const [overrideUser, setOverrideUser] = useState<UserRow | null>(null);
  const [userOverrides, setUserOverrides] = useState<Set<string>>(new Set());
  const [rolePermissions, setRolePermissions] = useState<Set<string>>(new Set());
  const [isSavingOverrides, setIsSavingOverrides] = useState(false);
  const [overrideMessage, setOverrideMessage] = useState<string | null>(null);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  const { tenantFeatureGates } = useRBAC();

  // Filter pages for override UI by tenant feature gates
  const filteredRegistry = useMemo(() => {
    if (tenantFeatureGates.size === 0) return PAGE_REGISTRY;
    return PAGE_REGISTRY.filter((p) =>
      !p.isAdminOnly &&
      (tenantFeatureGates.has(p.key) ||
        [...tenantFeatureGates].some((g) => p.key.startsWith(g + "/") || g.startsWith(p.key + "/")))
    );
  }, [tenantFeatureGates]);

  const pagesByGroup = getPagesByGroup(filteredRegistry);

  async function loadRoles() {
    try {
      const res = await fetch(`/api/${encodeURIComponent(hname)}/roles`);
      const data = (await res.json()) as { roles?: RoleRow[]; error?: string };
      setRoles(data.roles ?? []);
    } catch {
      // ignore
    }
  }

  async function loadUsers(active = true) {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/${encodeURIComponent(hname)}/manage-users`, {
        cache: "no-store",
      });
      const data = (await response.json()) as { rows?: UserRow[]; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load users.");
      }

      if (active) setUsers(data.rows ?? []);
    } catch (error) {
      if (active) {
        setSubmitError(error instanceof Error ? error.message : "Failed to load users.");
      }
    } finally {
      if (active) setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
    void loadRoles();
    return () => {
      // no-op
    };
  }, [hname]);

  async function saveUser(mode: "save" | "saveNext") {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitMessage(null);

    // Get role name from roles list
    const selectedRole = roles.find((r) => r.id === Number(form.role_id));
    const roleName = selectedRole ? selectedRole.name : form.role || "User";

    try {
      const response = await fetch(`/api/${encodeURIComponent(hname)}/manage-users`, {
        method: editingUserId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingUserId,
          username: form.username,
          password: form.password,
          role: roleName,
          role_id: form.role_id || null,
        }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save user.");
      }

      await loadUsers();
      setForm(emptyForm());
      setEditingUserId(null);
      setSubmitMessage(editingUserId ? "User updated successfully." : "User saved successfully.");
      setIsShowingForm(mode === "saveNext");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to save user.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteUser(id: number) {
    setSubmitError(null);
    setSubmitMessage(null);

    try {
      const response = await fetch(`/api/${encodeURIComponent(hname)}/manage-users`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete user.");
      }

      await loadUsers();
      setSubmitMessage("User deleted successfully.");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to delete user.");
    }
  }

  // Open the override panel for a user
  const openOverrides = useCallback(async (user: UserRow) => {
    setOverrideUserId(user.id);
    setOverrideUser(user);
    setOverrideError(null);
    setOverrideMessage(null);

    // Load user's current overrides
    const overrideRes = await fetch(
      `/api/${encodeURIComponent(hname)}/user-overrides?userId=${user.id}`
    );
    const overrideData = (await overrideRes.json()) as { pageKeys?: string[] };
    setUserOverrides(new Set(overrideData.pageKeys ?? []));

    // Load role permissions if user has a role
    if (user.role_id) {
      const roleRes = await fetch(
        `/api/${encodeURIComponent(hname)}/roles/${user.role_id}/permissions`
      );
      const roleData = (await roleRes.json()) as { pageKeys?: string[] };
      setRolePermissions(new Set(roleData.pageKeys ?? []));
    } else {
      setRolePermissions(new Set());
    }
  }, [hname]);

  async function saveOverrides() {
    if (!overrideUserId) return;
    setIsSavingOverrides(true);
    setOverrideError(null);
    setOverrideMessage(null);

    try {
      const res = await fetch(`/api/${encodeURIComponent(hname)}/user-overrides`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: overrideUserId,
          pageKeys: [...userOverrides],
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to save overrides.");
      setOverrideMessage("Page overrides saved successfully.");
    } catch (error) {
      setOverrideError(error instanceof Error ? error.message : "Failed to save overrides.");
    } finally {
      setIsSavingOverrides(false);
    }
  }

  const toggleOverride = (key: string) => {
    setUserOverrides((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <PageLayout title="Manage Users">
      <div className="space-y-6">
        {/* ── Users Table ─────────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-5xl rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-col gap-4 border-b border-gray-100 px-6 py-5 dark:border-gray-800 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
                Manage Users
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Create users and assign roles. Click the key icon to manage extra page access.
              </p>
            </div>

            {!isShowingForm ? (
              <button
                type="button"
                onClick={() => setIsShowingForm(true)}
                className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 focus:outline-hidden focus:ring-3 focus:ring-brand-500/25"
              >
                Add User
              </button>
            ) : null}
          </div>

          <div className="px-4 py-5 sm:px-6">
            {isShowingForm ? (
              <form
                className="mx-auto max-w-3xl space-y-8"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveUser("save");
                }}
              >
                <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
                  <div className="w-full max-w-[260px] justify-self-start">
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                      User Name
                    </label>
                    <input
                      value={form.username}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, username: event.target.value }))
                      }
                      className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                      required
                    />
                  </div>

                  <div className="w-full max-w-[260px] justify-self-start">
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                      Password {editingUserId && <span className="text-gray-400">(leave blank to keep)</span>}
                    </label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, password: event.target.value }))
                      }
                      className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                      required={!editingUserId}
                    />
                  </div>

                  <div className="w-full max-w-[260px] justify-self-start">
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">
                      Role
                    </label>
                    <div className="relative">
                      <select
                        value={form.role_id}
                        onChange={(e) => {
                          const id = e.target.value ? Number(e.target.value) : "";
                          const role = roles.find((r) => r.id === Number(id));
                          setForm((current) => ({
                            ...current,
                            role_id: id,
                            role: role ? role.name : "User",
                          }));
                        }}
                        className="h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                      >
                        <option value="">-- Select Role --</option>
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDownIcon className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-gray-400" />
                    </div>
                    {roles.length === 0 && (
                      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                        No roles created yet. Go to Settings → Roles to create roles first.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-gray-100 pt-5 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setForm(emptyForm());
                      setEditingUserId(null);
                      setIsShowingForm(false);
                    }}
                    className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
                  >
                    Cancel
                  </button>

                  <div className="flex flex-wrap justify-end gap-3">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => void saveUser("saveNext")}
                      className="inline-flex items-center justify-center rounded-lg border border-brand-500 px-4 py-2.5 text-sm font-medium text-brand-500 transition hover:bg-brand-50 focus:outline-hidden focus:ring-3 focus:ring-brand-500/25 dark:border-brand-500 dark:text-brand-400 dark:hover:bg-brand-500/10"
                    >
                      {isSubmitting ? "Saving..." : "Save & Add Another"}
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 focus:outline-hidden focus:ring-3 focus:ring-brand-500/25"
                    >
                      {isSubmitting ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>

                {submitMessage ? (
                  <p className="text-sm text-green-600 dark:text-green-400">{submitMessage}</p>
                ) : null}

                {submitError ? (
                  <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
                ) : null}
              </form>
            ) : (
              <div className="space-y-4">
                {isLoading ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Loading users...</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                      <thead className="bg-transparent">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">ID</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Username</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Role</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Created</th>
                          <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {users.map((user) => (
                          <tr key={user.id} className={overrideUserId === user.id ? "bg-brand-50 dark:bg-brand-900/10" : ""}>
                            <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">{user.id}</td>
                            <td className="px-4 py-4 text-sm font-medium text-gray-800 dark:text-white/90">{user.username}</td>
                            <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">
                              {user.role?.toLowerCase() === "admin" ? (
                                <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                  Admin
                                </span>
                              ) : user.role_name ? (
                                <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
                                  {user.role_name}
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                                  No Role
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">{user.created_at ?? "-"}</td>
                            <td className="px-4 py-4">
                              <div className="flex items-center justify-end gap-2">
                                {/* Edit user */}
                                <button
                                  type="button"
                                  title="Edit user"
                                  onClick={() => {
                                    setForm({
                                      username: user.username,
                                      password: "",
                                      role_id: user.role_id ?? "",
                                      role: user.role_name ?? user.role ?? "",
                                    });
                                    setEditingUserId(user.id);
                                    setIsShowingForm(true);
                                    setSubmitError(null);
                                    setSubmitMessage(null);
                                  }}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
                                >
                                  <PencilIcon className="h-4 w-4" />
                                </button>

                                {/* Page overrides — only for non-admin */}
                                {user.role?.toLowerCase() !== "admin" ? (
                                  <button
                                    type="button"
                                    title="Manage page overrides"
                                    onClick={() => {
                                      if (overrideUserId === user.id) {
                                        setOverrideUserId(null);
                                        setOverrideUser(null);
                                      } else {
                                        void openOverrides(user);
                                      }
                                    }}
                                    className={`inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-medium transition ${overrideUserId === user.id
                                      ? "border-brand-500 bg-brand-500 text-white"
                                      : "border-brand-200 bg-brand-50 text-brand-600 hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-900/20 dark:text-brand-400"
                                      }`}
                                  >
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                    </svg>
                                    Overrides
                                  </button>
                                ) : null}

                                {/* Delete user */}
                                {user.role?.toLowerCase() !== "admin" ? (
                                  <button
                                    type="button"
                                    title="Delete user"
                                    onClick={() => void deleteUser(user.id)}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-100 bg-white text-red-500 transition hover:bg-red-50 hover:text-red-600 dark:border-red-900/40 dark:bg-gray-900 dark:text-red-400 dark:hover:bg-red-950/30"
                                  >
                                    <TrashBinIcon className="h-4 w-4" />
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {submitMessage ? (
                  <p className="text-sm text-green-600 dark:text-green-400">{submitMessage}</p>
                ) : null}

                {submitError ? (
                  <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
                ) : null}
              </div>
            )}
          </div>
        </section>

        {/* ── User Page Overrides Panel ─────────────────────────────────────── */}
        {overrideUser && overrideUserId && (
          <section className="mx-auto max-w-5xl rounded-2xl border border-brand-200 bg-white dark:border-brand-800/40 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between border-b border-brand-100 px-6 py-4 dark:border-brand-900/30">
              <div>
                <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
                  Extra Page Access — <span className="text-brand-600 dark:text-brand-400">{overrideUser.username}</span>
                </h3>
                <p className="mt-0.5 text-sm text-gray-500">
                  Grant this user access to specific pages beyond their role permissions.
                  Pages already accessible via their role are shown but cannot be removed here.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setOverrideUserId(null); setOverrideUser(null); }}
                className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(pagesByGroup).map(([group, pages]) => (
                  <div key={group} className="rounded-xl border border-gray-100 p-4 dark:border-gray-800">
                    <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {group}
                    </h4>
                    <div className="space-y-2">
                      {pages.map((page) => {
                        const isFromRole = rolePermissions.has(page.key);
                        const isOverride = userOverrides.has(page.key);

                        return (
                          <label
                            key={page.key}
                            className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors ${isFromRole
                              ? "opacity-60 cursor-not-allowed"
                              : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                              }`}
                          >
                            <input
                              type="checkbox"
                              checked={isFromRole || isOverride}
                              disabled={isFromRole}
                              onChange={() => !isFromRole && toggleOverride(page.key)}
                              className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500 disabled:opacity-50"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {page.label}
                            </span>
                            {isFromRole && (
                              <span className="ml-auto rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-400 dark:bg-gray-800">
                                role
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-800">
                <div>
                  {overrideMessage && (
                    <p className="text-sm text-green-600 dark:text-green-400">{overrideMessage}</p>
                  )}
                  {overrideError && (
                    <p className="text-sm text-red-600 dark:text-red-400">{overrideError}</p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={isSavingOverrides}
                  onClick={() => void saveOverrides()}
                  className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/25 disabled:opacity-50"
                >
                  {isSavingOverrides ? "Saving..." : "Save Overrides"}
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </PageLayout>
  );
}
