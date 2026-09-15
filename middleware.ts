import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyPermissionJWT, isPathPermitted, permsCookieName } from './lib/jwt';

// Cookie names (mirrored from lib/super-admin.ts — no server imports in middleware)
const SUPER_ADMIN_COOKIE = 'super_admin_session';

function tenantGatesCookieName(hname: string): string {
  return `tgates_${hname.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Static / system routes — always pass through ──────────────────────────
  if (
    pathname.startsWith('/_next') ||
    pathname.includes('.') || // static files
    pathname === '/' ||
    pathname === '/create-account'
  ) {
    return NextResponse.next();
  }

  // ── API routes — pass through (they handle their own auth) ────────────────
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // ══ SUPER ADMIN ROUTES ════════════════════════════════════════════════════
  if (pathname.startsWith('/SuperAdmin')) {
    // Login page is always accessible
    if (pathname === '/SuperAdmin/login' || pathname === '/SuperAdmin/login/') {
      return NextResponse.next();
    }

    // All other /SuperAdmin/* routes require super admin session
    const superAdminCookie = request.cookies.get(SUPER_ADMIN_COOKIE);

    if (!superAdminCookie?.value) {
      return NextResponse.redirect(new URL('/SuperAdmin/login', request.url));
    }

    // Verify the super admin JWT
    const payload = await verifyPermissionJWT(superAdminCookie.value);
    if (!payload || !payload.pages.includes('__super_admin__')) {
      const response = NextResponse.redirect(new URL('/SuperAdmin/login', request.url));
      response.cookies.delete(SUPER_ADMIN_COOKIE);
      return response;
    }

    return NextResponse.next();
  }

  // ══ TENANT ROUTES ═════════════════════════════════════════════════════════
  // Route structure: /[Hname]/...
  const parts = pathname.split('/').filter(Boolean);

  if (parts.length <= 1) {
    // /[Hname] — the login page itself. Always allow.
    return NextResponse.next();
  }

  const hname = decodeURIComponent(parts[0]);
  const subPath = '/' + parts.slice(1).join('/'); // e.g. "/masters/clinical-masters/symptoms"

  // ── Public sub-routes (no auth needed) ───────────────────────────────────
  const publicSubRoutes = [
    'book-appointment',
    'patient-login',
    'patient-dashboard',
    'patient-book-appointment',
    'patient-appointments',
    'patient-profile',
    'patient-history',
    'manage-family',
    'access-denied',
    'feature-unavailable', // Tenant feature gate denied page
  ];
  if (publicSubRoutes.includes(parts[1])) {
    return NextResponse.next();
  }

  // ── Auth check — must be logged in ───────────────────────────────────────
  const authCookieKey = `auth_${hname.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const authCookie = request.cookies.get(authCookieKey);

  if (!authCookie?.value) {
    // Not logged in — redirect to hospital login page
    return NextResponse.redirect(new URL(`/${encodeURIComponent(hname)}`, request.url));
  }

  // ── RBAC check — must have permission for this specific page ─────────────
  const permsCookieKey = permsCookieName(hname);
  const permsCookie = request.cookies.get(permsCookieKey);

  // If no permissions cookie, force re-login to get fresh permissions
  if (!permsCookie?.value) {
    const loginUrl = new URL(`/${encodeURIComponent(hname)}`, request.url);
    loginUrl.searchParams.set('reason', 'session_expired');
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(authCookieKey);
    return response;
  }

  const payload = await verifyPermissionJWT(permsCookie.value);

  if (!payload) {
    // JWT invalid or expired — force re-login
    const loginUrl = new URL(`/${encodeURIComponent(hname)}`, request.url);
    loginUrl.searchParams.set('reason', 'session_expired');
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(authCookieKey);
    response.cookies.delete(permsCookieKey);
    return response;
  }

  // ── Tenant feature gate check ─────────────────────────────────────────────
  // Checks if the super admin has restricted this tenant's features.
  // Core admin pages (/manage-users, /settings) are tenant administration tools,
  // not tenant feature modules, and are thus exempt from tenant feature gates.
  const isCoreAdminPage =
    subPath === '/manage-users' ||
    subPath.startsWith('/manage-users/') ||
    subPath === '/settings' ||
    subPath.startsWith('/settings/');

  if (!isCoreAdminPage) {
    const tenantGatesCookie = request.cookies.get(tenantGatesCookieName(hname));
    if (tenantGatesCookie?.value) {
      const gatePayload = await verifyPermissionJWT(tenantGatesCookie.value);
      if (gatePayload) {
        // gatePayload.pages = ["*"] means full access (no restriction)
        const isFullAccess = gatePayload.pages.length === 1 && gatePayload.pages[0] === '*';
        if (!isFullAccess && !isPathPermitted(gatePayload, subPath)) {
          // Tenant does not have this feature licensed
          const unavailableUrl = new URL(`/${encodeURIComponent(hname)}/feature-unavailable`, request.url);
          unavailableUrl.searchParams.set('path', subPath);
          return NextResponse.redirect(unavailableUrl);
        }
      }
    }
  }

  // ── User-level RBAC check ─────────────────────────────────────────────────
  if (isCoreAdminPage) {
    const isUserAdmin = payload.pages.includes('*');
    if (!isUserAdmin) {
      const deniedUrl = new URL(`/${encodeURIComponent(hname)}/access-denied`, request.url);
      deniedUrl.searchParams.set('path', subPath);
      return NextResponse.redirect(deniedUrl);
    }
  } else if (!isPathPermitted(payload, subPath)) {
    // Access denied — redirect to access-denied page
    const deniedUrl = new URL(`/${encodeURIComponent(hname)}/access-denied`, request.url);
    deniedUrl.searchParams.set('path', subPath);
    return NextResponse.redirect(deniedUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
