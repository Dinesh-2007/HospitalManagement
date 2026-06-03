import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Ignore static assets, api routes, and root level pages like / and /create-account
  if (
    pathname.startsWith('/_next') ||
    pathname.includes('.') || // static files
    pathname.startsWith('/api') ||
    pathname === '/' ||
    pathname === '/create-account'
  ) {
    return NextResponse.next();
  }

  // Assuming format /Hname/...
  // Everything beyond /Hname requires auth
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length > 1) {
    // Let book-appointment and book-appointment/calendar pass without auth
    if (parts[1] === 'book-appointment' || (parts[1] === 'book-appointment' && parts[2] === 'calendar')) {
      return NextResponse.next();
    }
    
    const hname = decodeURIComponent(parts[0]);
    // The login page is /Hname (parts.length === 1). 
    // parts.length > 1 means they are tyring to access /Hname/something
    const authCookie = request.cookies.get(`auth_${hname.replace(/[^a-zA-Z0-9]/g, '_')}`);
    
    if (!authCookie || !authCookie.value) {
      // Redirect to login page
      return NextResponse.redirect(new URL(`/${encodeURIComponent(hname)}`, request.url));
    }
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
