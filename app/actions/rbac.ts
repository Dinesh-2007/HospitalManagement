"use server";

import { getTenantDB } from "../../lib/db";
import { cookies } from "next/headers";

// ─── Table setup ─────────────────────────────────────────────────────────────

/**
 * Ensure all RBAC tables exist in the tenant DB.
 * Idempotent — safe to call on every request or at tenant creation time.
 */
export async function ensureRBACTables(hname: string): Promise<void> {
  const pool = await getTenantDB(hname);

  // Create roles table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      description TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create role_page_permissions table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_page_permissions (
      id SERIAL PRIMARY KEY,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      page_key VARCHAR(500) NOT NULL,
      UNIQUE(role_id, page_key)
    )
  `);

  // Create user_page_overrides table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_page_overrides (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      page_key VARCHAR(500) NOT NULL,
      UNIQUE(user_id, page_key)
    )
  `);

  // Add role_id column to users table if not exists
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL
  `);
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

async function getAuthUsername(hname: string): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(`auth_${hname.replace(/[^a-zA-Z0-9]/g, "_")}`);
  return cookie?.value ?? null;
}

async function checkIsAdminInternal(hname: string, username: string): Promise<boolean> {
  const pool = await getTenantDB(hname);
  const res = await pool.query<{ role: string }>(
    "SELECT role FROM users WHERE username = $1 LIMIT 1",
    [username]
  );
  return res.rows[0]?.role?.toLowerCase() === "admin";
}

async function requireAdmin(hname: string): Promise<void> {
  const username = await getAuthUsername(hname);
  if (!username) throw new Error("Unauthorized");
  const isAdmin = await checkIsAdminInternal(hname, username);
  if (!isAdmin) throw new Error("Unauthorized");
}

// ─── Roles CRUD ───────────────────────────────────────────────────────────────

export type RoleRow = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  user_count?: number;
};

export async function getRoles(hname: string): Promise<RoleRow[]> {
  await ensureRBACTables(hname);
  const pool = await getTenantDB(hname);

  const res = await pool.query<RoleRow>(`
    SELECT r.id, r.name, r.description, r.created_at,
           COUNT(u.id)::int AS user_count
    FROM roles r
    LEFT JOIN users u ON u.role_id = r.id
    GROUP BY r.id, r.name, r.description, r.created_at
    ORDER BY r.created_at ASC
  `);
  return res.rows;
}

export async function createRole(
  hname: string,
  name: string,
  description: string
): Promise<RoleRow> {
  await requireAdmin(hname);
  await ensureRBACTables(hname);

  const safeName = name.trim();
  if (!safeName) throw new Error("Role name is required");
  if (safeName.toLowerCase() === "admin") throw new Error("'admin' is a reserved role name");

  const pool = await getTenantDB(hname);
  const res = await pool.query<RoleRow>(
    "INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING *",
    [safeName, description.trim() || null]
  );
  return res.rows[0];
}

export async function updateRole(
  hname: string,
  roleId: number,
  name: string,
  description: string
): Promise<void> {
  await requireAdmin(hname);
  await ensureRBACTables(hname);

  const safeName = name.trim();
  if (!safeName) throw new Error("Role name is required");
  if (safeName.toLowerCase() === "admin") throw new Error("'admin' is a reserved role name");

  const pool = await getTenantDB(hname);
  await pool.query(
    "UPDATE roles SET name = $1, description = $2 WHERE id = $3",
    [safeName, description.trim() || null, roleId]
  );
}

export async function deleteRole(hname: string, roleId: number): Promise<void> {
  await requireAdmin(hname);
  const pool = await getTenantDB(hname);

  // Null out users that had this role before deleting
  await pool.query("UPDATE users SET role_id = NULL WHERE role_id = $1", [roleId]);
  await pool.query("DELETE FROM roles WHERE id = $1", [roleId]);
}

// ─── Role Permissions ─────────────────────────────────────────────────────────

export async function getRolePermissions(
  hname: string,
  roleId: number
): Promise<string[]> {
  await ensureRBACTables(hname);
  const pool = await getTenantDB(hname);

  const res = await pool.query<{ page_key: string }>(
    "SELECT page_key FROM role_page_permissions WHERE role_id = $1",
    [roleId]
  );
  return res.rows.map((r) => r.page_key);
}

export async function setRolePermissions(
  hname: string,
  roleId: number,
  pageKeys: string[]
): Promise<void> {
  await requireAdmin(hname);
  await ensureRBACTables(hname);

  const pool = await getTenantDB(hname);

  // Replace all permissions for this role atomically
  await pool.query("BEGIN");
  try {
    await pool.query("DELETE FROM role_page_permissions WHERE role_id = $1", [roleId]);

    for (const key of pageKeys) {
      await pool.query(
        "INSERT INTO role_page_permissions (role_id, page_key) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [roleId, key]
      );
    }
    await pool.query("COMMIT");
  } catch (err) {
    await pool.query("ROLLBACK");
    throw err;
  }
}

// ─── User Page Overrides ──────────────────────────────────────────────────────

export async function getUserOverrides(
  hname: string,
  userId: number
): Promise<string[]> {
  await ensureRBACTables(hname);
  const pool = await getTenantDB(hname);

  const res = await pool.query<{ page_key: string }>(
    "SELECT page_key FROM user_page_overrides WHERE user_id = $1",
    [userId]
  );
  return res.rows.map((r) => r.page_key);
}

export async function setUserOverrides(
  hname: string,
  userId: number,
  pageKeys: string[]
): Promise<void> {
  await requireAdmin(hname);
  await ensureRBACTables(hname);

  const pool = await getTenantDB(hname);

  await pool.query("BEGIN");
  try {
    await pool.query("DELETE FROM user_page_overrides WHERE user_id = $1", [userId]);

    for (const key of pageKeys) {
      await pool.query(
        "INSERT INTO user_page_overrides (user_id, page_key) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [userId, key]
      );
    }
    await pool.query("COMMIT");
  } catch (err) {
    await pool.query("ROLLBACK");
    throw err;
  }
}

// ─── Permission Resolution ────────────────────────────────────────────────────

export type UserPermissionInfo = {
  isAdmin: boolean;
  /** Allowed page keys. Empty array = no access. ["*"] = full access (admin). */
  allowedPages: string[];
};

/**
 * Resolve the full set of allowed pages for a given username.
 * Used at login time to build the permission cookie payload.
 */
export async function resolveUserPermissions(
  hname: string,
  username: string
): Promise<UserPermissionInfo> {
  await ensureRBACTables(hname);
  const pool = await getTenantDB(hname);

  const userRes = await pool.query<{ id: number; role: string; role_id: number | null }>(
    "SELECT id, role, role_id FROM users WHERE username = $1 LIMIT 1",
    [username]
  );

  if (userRes.rowCount === 0) {
    return { isAdmin: false, allowedPages: [] };
  }

  const user = userRes.rows[0];

  // Admin bypass
  if (user.role?.toLowerCase() === "admin") {
    return { isAdmin: true, allowedPages: ["*"] };
  }

  const allowedSet = new Set<string>();

  // Role-based permissions
  if (user.role_id != null) {
    const rolePerms = await pool.query<{ page_key: string }>(
      "SELECT page_key FROM role_page_permissions WHERE role_id = $1",
      [user.role_id]
    );
    for (const row of rolePerms.rows) {
      allowedSet.add(row.page_key);
    }
  }

  // User-specific overrides (additive)
  const overrides = await pool.query<{ page_key: string }>(
    "SELECT page_key FROM user_page_overrides WHERE user_id = $1",
    [user.id]
  );
  for (const row of overrides.rows) {
    allowedSet.add(row.page_key);
  }

  return { isAdmin: false, allowedPages: [...allowedSet] };
}
