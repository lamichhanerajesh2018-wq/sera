// lib/admin-auth.ts
// Tiny session layer for the private admin area. Instead of passing the secret
// in the URL (?key=…), the admin signs in once at /admin/login; we set an
// httpOnly cookie holding an HMAC of the secret. Pages/actions then just check
// the cookie. No new dependency — uses Node's crypto.
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "sera_admin";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// Derive a stable token from the secret so the raw secret never sits in the
// cookie. If the secret changes, all existing admin cookies become invalid.
function tokenFor(secret: string): string {
  return createHmac("sha256", secret).update("sera-admin-v1").digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

// Validate a password attempt against ADMIN_SECRET. On success, set the cookie.
export async function adminSignIn(password: string): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || !password) return false;
  if (!safeEqual(password, secret)) return false;

  const store = await cookies();
  store.set(COOKIE_NAME, tokenFor(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
  return true;
}

// Clear the admin cookie (logout).
export async function adminSignOut(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

// True if the current request carries a valid admin cookie.
export async function isAdmin(): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const store = await cookies();
  const cookie = store.get(COOKIE_NAME)?.value;
  if (!cookie) return false;
  return safeEqual(cookie, tokenFor(secret));
}
