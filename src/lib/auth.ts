import { cookies } from 'next/headers';

const GUEST_COOKIE = 'guest_id';
const ADMIN_COOKIE = 'admin_session';

// The `Secure` cookie flag is honored by browsers ONLY over HTTPS. Setting it on
// an HTTP origin makes the browser silently DROP the cookie (RFC 6265bis §4.1.2.5).
// This was the exact root cause of "impossible to create an account" when REGARDS
// was first served behind sslip.io (HTTP only): POST /api/guests returned 201, but
// the Set-Cookie header was discarded, so the middleware kept redirecting /feed → /join.
// We tie `Secure` to the actual public URL protocol rather than NODE_ENV so the app
// works in dev (http://localhost), in HTTP-only test deployments (sslip.io), AND
// keeps cookies secure on real HTTPS production.
const useSecureCookies = (process.env.NEXT_PUBLIC_APP_URL ?? '').startsWith('https://');

export async function getGuestId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(GUEST_COOKIE)?.value ?? null;
}

export async function setGuestId(guestId: string) {
  const cookieStore = await cookies();
  cookieStore.set(GUEST_COOKIE, guestId, {
    httpOnly: true,
    secure: useSecureCookies,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });
}

export async function getAdminSession(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_COOKIE)?.value === 'authenticated';
}

export async function setAdminSession() {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, 'authenticated', {
    httpOnly: true,
    secure: useSecureCookies,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  });
}