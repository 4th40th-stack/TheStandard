import { NextResponse } from 'next/server';

const FLOW_COOKIE = 'flow';
const COOKIE_MAX_AGE = 600; // 10 minutes

const PUBLIC_PATHS = ['/', '/login', '/login/forgot-username', '/login/forgot-password'];
const PROTECTED_2FA = '/login/2fa';
const PROTECTED_VERIFY = '/login/verify';

function isAllowedPath(pathname) {
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/') || pathname === '/favicon.ico') {
    return true;
  }
  if (pathname.startsWith('/_next') || pathname.includes('.')) return true;
  return false;
}

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Static / API / Next internals
  if (isAllowedPath(pathname)) {
    return NextResponse.next();
  }

  // Public pages: set flow=login so user can proceed to 2fa after submitting login
  if (pathname === '/' || pathname === '/login') {
    const res = NextResponse.next();
    res.cookies.set(FLOW_COOKIE, 'login', { path: '/', maxAge: COOKIE_MAX_AGE, httpOnly: true, sameSite: 'lax' });
    return res;
  }

  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  // Protected: /login/2fa — must have come from login
  if (pathname === PROTECTED_2FA) {
    const flow = request.cookies.get(FLOW_COOKIE)?.value;
    if (flow === 'login' || flow === '2fa') {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Protected: /login/verify — must have come from 2fa
  if (pathname.startsWith(PROTECTED_VERIFY)) {
    const flow = request.cookies.get(FLOW_COOKIE)?.value;
    if (flow === 'login' || flow === '2fa' || flow === 'verify') {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Any other path: send to login
  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
