"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

type RBACContextValue = {
  isAdmin: boolean;
  allowedPages: Set<string>;
  isLoading: boolean;
  /**
   * Returns true if the user can access the given page key.
   * Admin always returns true.
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
  error?: string;
};

export function RBACProvider({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const hname = params?.Hname ? decodeURIComponent(params.Hname as string) : null;

  const [isAdmin, setIsAdmin] = useState(false);
  const [allowedPages, setAllowedPages] = useState<Set<string>>(new Set());
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
        return;
      }

      const data = (await res.json()) as PermissionResponse;

      if (data.isAdmin) {
        setIsAdmin(true);
        // Admin wildcard — represented as a special Set with "*"
        setAllowedPages(new Set(["*"]));
      } else {
        setIsAdmin(false);
        setAllowedPages(new Set(data.allowedPages ?? []));
      }
    } catch {
      setIsAdmin(false);
      setAllowedPages(new Set());
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
      if (isAdmin || allowedPages.has("*")) return true;

      // Exact match
      if (allowedPages.has(pageKey)) return true;

      // Check descendants and ancestors
      for (const allowed of allowedPages) {
        // pageKey is a descendant of an allowed key (e.g. /masters/clinical under /masters)
        if (pageKey.startsWith(allowed + "/")) return true;
        // pageKey is an ancestor of an allowed key (e.g. /masters is parent of /masters/clinical/symptoms)
        if (allowed.startsWith(pageKey + "/")) return true;
      }

      return false;
    },
    [isAdmin, allowedPages, isLoading]
  );

  return (
    <RBACContext.Provider
      value={{
        isAdmin,
        allowedPages,
        isLoading,
        canAccess,
        reload: fetchPermissions,
      }}
    >
      {children}
    </RBACContext.Provider>
  );
}
