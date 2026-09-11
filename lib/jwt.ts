/**
 * JWT utility — HMAC-SHA256 tokens for permission cookies.
 *
 * Uses the Web Crypto API (crypto.subtle) which is available in:
 *  - Node.js 18+
 *  - Next.js Edge Runtime (middleware)
 *  - All modern browsers
 *
 * This makes the module usable in Next.js middleware without issues.
 */

const EXPIRY_SECONDS = 60 * 60 * 24; // 24 hours

function getSecret(): string {
  // Try RBAC_JWT_SECRET first, then fall back
  const secret =
    (typeof process !== "undefined" && process.env?.RBAC_JWT_SECRET) ||
    (typeof process !== "undefined" && process.env?.DB_PASSWORD) ||
    "hsms-rbac-default-secret-change-me";
  return secret;
}

function base64urlEncode(bytes: Uint8Array): string {
  // Convert Uint8Array to base64url
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlEncodeString(str: string): string {
  const encoder = new TextEncoder();
  return base64urlEncode(encoder.encode(str));
}

function base64urlDecode(str: string): string {
  // Re-pad
  const padded = str + "===".slice((str.length + 3) % 4);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return atob(base64);
  } catch {
    throw new Error("Invalid base64url");
  }
}

async function hmacSign(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  return base64urlEncode(new Uint8Array(signature));
}

async function hmacVerify(data: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  // Decode the signature
  const padded = signature + "===".slice((signature.length + 3) % 4);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  let sigBytes: Uint8Array;
  try {
    const binary = atob(base64);
    sigBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      sigBytes[i] = binary.charCodeAt(i);
    }
  } catch {
    return false;
  }

  try {
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    return await crypto.subtle.verify("HMAC", cryptoKey, sigBytes.buffer as ArrayBuffer, messageData);
  } catch {
    return false;
  }
}

export type PermissionPayload = {
  /** username */
  sub: string;
  /**
   * Allowed page keys.
   * Special value ["*"] means admin — all pages allowed.
   */
  pages: string[];
  iat: number;
  exp: number;
};

/**
 * Sign a permission payload and return a compact JWT string.
 * Returns a promise — must be awaited.
 */
export async function signPermissionJWT(
  payload: Omit<PermissionPayload, "iat" | "exp">
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: PermissionPayload = {
    ...payload,
    iat: now,
    exp: now + EXPIRY_SECONDS,
  };

  const header = base64urlEncodeString(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64urlEncodeString(JSON.stringify(fullPayload));
  const signature = await hmacSign(`${header}.${body}`, getSecret());

  return `${header}.${body}.${signature}`;
}

/**
 * Verify and decode a permission JWT.
 * Returns null if invalid or expired.
 */
export async function verifyPermissionJWT(token: string): Promise<PermissionPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    const valid = await hmacVerify(`${header}.${body}`, signature, getSecret());
    if (!valid) return null;

    const payload = JSON.parse(base64urlDecode(body)) as PermissionPayload;

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}

/**
 * Check if a given path is permitted by the payload.
 *
 * Admin (pages === ["*"]) always returns true.
 * Otherwise checks:
 *  1. Exact match or descendant match (normalizedPath starts with allowed key)
 *  2. Ancestor match (normalizedPath is a parent prefix of any allowed key)
 *     — allows landing/index pages like /masters to be accessible if user has any /masters/... permission
 */
export function isPathPermitted(payload: PermissionPayload, normalizedPath: string): boolean {
  // Admin wildcard
  if (payload.pages.length === 1 && payload.pages[0] === "*") {
    return true;
  }

  for (const allowed of payload.pages) {
    // Exact match
    if (normalizedPath === allowed) return true;
    // normalizedPath is a descendant of allowed
    if (normalizedPath.startsWith(allowed + "/")) return true;
    // normalizedPath is an ancestor of allowed (e.g. /masters is parent of /masters/clinical-masters/symptoms)
    if (allowed.startsWith(normalizedPath + "/")) return true;
  }

  return false;
}

/**
 * Returns the cookie name for the permissions token for a given hname.
 */
export function permsCookieName(hname: string): string {
  return `perms_${hname.replace(/[^a-zA-Z0-9]/g, "_")}`;
}
