"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BlankPage } from "../../../components/blank-page";
import { PencilIcon, TrashBinIcon } from "../../../components/icons";

type UserRow = {
  id: number;
  username: string;
  role: string;
  created_at?: string;
};

type FormState = {
  username: string;
  password: string;
  role: string;
};

function emptyForm(): FormState {
  return {
    username: "",
    password: "",
    role: "",
  };
}

export default function ManageUsersPage() {
  const params = useParams();
  const hname = decodeURIComponent((params?.Hname as string) ?? "");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isShowingForm, setIsShowingForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    const loadUsers = async () => {
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
    };

    void loadUsers();
    return () => {
      active = false;
    };
  }, [hname]);

  async function saveUser(mode: "save" | "saveNext") {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitMessage(null);

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
          role: form.role,
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

  return (
    <BlankPage title="Manage Users">
      <section className="mx-auto max-w-4xl rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-4 border-b border-gray-100 px-6 py-5 dark:border-gray-800 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-medium text-gray-800 dark:text-white/90">
              Manage Users
            </h3>
          </div>

          {!isShowingForm ? (
            <button
              type="button"
              onClick={() => setIsShowingForm(true)}
              className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 focus:outline-hidden focus:ring-3 focus:ring-brand-500/25"
            >
              Add Manage Users
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
                    Password
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
                  <input
                    value={form.role}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, role: event.target.value }))
                    }
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                    required
                  />
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
                    {isSubmitting ? "Saving..." : "Save Next"}
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
              <div>
                <h3 className="text-base font-medium text-gray-800 dark:text-white/90">
                  Saved Records
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Latest entries stored in the users table.
                </p>
              </div>

              {isLoading ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading saved records...</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                    <thead className="bg-transparent">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Created At</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">User Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Role</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {users.map((user) => (
                        <tr key={user.id}>
                          <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">{user.id}</td>
                          <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">{user.created_at ?? "-"}</td>
                          <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">{user.username}</td>
                          <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">{user.role || "-"}</td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setForm({
                                    username: user.username,
                                    password: "",
                                    role: user.role || "",
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
                              {user.username !== "admin" ? (
                                <button
                                  type="button"
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
    </BlankPage>
  );
}
