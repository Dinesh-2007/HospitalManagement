"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/super-admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = (await res.json()) as { ok?: boolean; error?: string };

      if (!res.ok) throw new Error(data.error ?? "Login failed");
      router.push("/SuperAdmin/tenants");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-gray-900 px-4">
      {/* Background decoration */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-violet-600/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-indigo-600/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo badge */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/30">
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">Super Admin</h1>
            <p className="mt-1 text-sm text-slate-400">HSMS SaaS Control Panel</p>
          </div>
        </div>

        {/* Login card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin@hsms.io"
                required
                autoComplete="username"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:from-violet-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50"
            >
              {isLoading ? "Signing in..." : "Sign in to Super Admin"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500">
            If no super admin exists, the first login creates the account.
          </p>
        </div>

        {/* Back to main site */}
        <div className="mt-4 text-center">
          <a href="/" className="text-xs text-slate-500 hover:text-slate-400 transition">
            ← Back to main site
          </a>
        </div>
      </div>
    </div>
  );
}
