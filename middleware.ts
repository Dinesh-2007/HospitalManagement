import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyPermissionJWT, isPathPermitted, permsCookieName } from './lib/jwt';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Static / system routes — always pass through ──────────────────────────
  if (
    pathname.startsWith('/_next') ||
    pathname.includes('.') || // static files
    pathname.startsWith('/api') ||
    pathname === '/' ||
    pathname === '/create-account'
  ) {
    return NextResponse.next();
  }

  // ── Route structure: /[Hname]/... ─────────────────────────────────────────
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
    'access-denied', // the access denied page itself must be accessible
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

  // If no permissions cookie, the user logged in before RBAC was deployed.
  // Force re-login to get fresh permissions.
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

  // Check if the requested sub-path is permitted
  if (!isPathPermitted(payload, subPath)) {
    // Access denied — redirect to access-denied page
    const deniedUrl = new URL(`/${encodeURIComponent(hname)}/access-denied`, request.url);
    deniedUrl.searchParams.set('path', subPath);
    return NextResponse.redirect(deniedUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
