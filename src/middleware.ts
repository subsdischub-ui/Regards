import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_PATHS = ['/feed', '/upload', '/challenges', '/moments', '/leaderboard', '/media', '/guestbook', '/profile'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // CORS
  const origin = request.headers.get('origin');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl && origin && origin !== appUrl) {
    return new NextResponse(null, { status: 403 });
  }

  // Guest auth check for protected pages
  const guestId = request.cookies.get('guest_id')?.value;

  if (PROTECTED_PATHS.some((p) => pathname.startsWith(p)) && !guestId) {
    return NextResponse.redirect(new URL('/join', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/feed/:path*',
    '/upload/:path*',
    '/challenges/:path*',
    '/moments/:path*',
    '/leaderboard/:path*',
    '/media/:path*',
    '/guestbook/:path*',
    '/profile/:path*',
  ],
};