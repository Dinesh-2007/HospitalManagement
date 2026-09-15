"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

type RBACContextValue = {
  isAdmin: boolean;
  allowedPages: Set<string>;
  /** Tenant-level feature gates (from super admin). Empty = full access. */
  tenantFeatureGates: Set<string>;
  isLoading: boolean;
  /**
   * Returns true if the user can access the given page key.
   * Checks BOTH tenant feature gates AND user RBAC.
   * Admin always bypasses user RBAC but not tenant feature gates.
   */
  canAccess: (pageKey: string) => boolean;
  /**
   * Reload permissions (call after admin changes role/overrides).
   */
  reload: () => Promise<void>;
};

const RBACContext = createContext<RBACContextValue>({
  isAdmin: false,
  allowedPages: new Set(),
  tenantFeatureGates: new Set(),
  isLoading: true,
  canAccess: () => false,
  reload: async () => {},
});

export function useRBAC() {
  return useContext(RBACContext);
}

type PermissionResponse = {
  isAdmin: boolean;
  allowedPages: string[];
  tenantFeatureGates: string[];
  error?: string;
};

function matchesPath(pageKey: string, allowedSet: Set<string>): boolean {
  if (allowedSet.has(pageKey)) return true;
  for (const allowed of allowedSet) {
    if (pageKey.startsWith(allowed + "/")) return true;
    if (allowed.startsWith(pageKey + "/")) return true;
  }
  return false;
}

export function RBACProvider({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const hname = params?.Hname ? decodeURIComponent(params.Hname as string) : null;

  const [isAdmin, setIsAdmin] = useState(false);
  const [allowedPages, setAllowedPages] = useState<Set<string>>(new Set());
  const [tenantFeatureGates, setTenantFeatureGates] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    if (!hname) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/${encodeURIComponent(hname)}/my-permissions`, {
        cache: "no-store",
      });

      if (!res.ok) {
        setIsAdmin(false);
        setAllowedPages(new Set());
        setTenantFeatureGates(new Set());
        return;
      }

      const data = (await res.json()) as PermissionResponse;

      if (data.isAdmin) {
        setIsAdmin(true);
        setAllowedPages(new Set(["*"]));
      } else {
        setIsAdmin(false);
        setAllowedPages(new Set(data.allowedPages ?? []));
      }

      // Tenant feature gates: empty = full access (no restriction from super admin)
      setTenantFeatureGates(new Set(data.tenantFeatureGates ?? []));
    } catch {
      setIsAdmin(false);
      setAllowedPages(new Set());
      setTenantFeatureGates(new Set());
    } finally {
      setIsLoading(false);
    }
  }, [hname]);

  useEffect(() => {
    void fetchPermissions();
  }, [fetchPermissions]);

  const canAccess = useCallback(
    (pageKey: string): boolean => {
      if (isLoading) return true; // optimistic while loading

      const isCoreAdminPage =
        pageKey === "/manage-users" ||
        pageKey === "/settings" ||
        pageKey.startsWith("/manage-users/") ||
        pageKey.startsWith("/settings/");

      // Core administration pages are accessible to tenant admins
      // and are not restricted by clinical/billing feature gates.
      if (isCoreAdminPage) {
        return isAdmin;
      }

      // ── Layer 1: Tenant feature gate check ──────────────────────────────────
      // If tenantFeatureGates is non-empty, the super admin has restricted features.
      // The page must be within the allowed tenant features.
      if (tenantFeatureGates.size > 0 && !matchesPath(pageKey, tenantFeatureGates)) {
        return false; // Feature not enabled for this tenant
      }

      // ── Layer 2: User RBAC check ─────────────────────────────────────────────
      if (isAdmin || allowedPages.has("*")) return true;

      // Exact match
      if (allowedPages.has(pageKey)) return true;

      return matchesPath(pageKey, allowedPages);
    },
    [isAdmin, allowedPages, tenantFeatureGates, isLoading]
  );

  return (
    <RBACContext.Provider
      value={{
        isAdmin,
        allowedPages,
        tenantFeatureGates,
        isLoading,
        canAccess,
        reload: fetchPermissions,
      }}
    >
      {children}
    </RBACContext.Provider>
  );
}
