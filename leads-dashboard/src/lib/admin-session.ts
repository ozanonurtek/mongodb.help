import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "mh_admin";

export function cookieName() {
  return COOKIE_NAME;
}

/**
 * Build an absolute /login URL from proxy headers.
 *
 * `req.nextUrl` resolves host/protocol from the container listener when Next.js
 * runs standalone behind a reverse proxy (nginx → 0.0.0.0:3434), producing
 * broken public redirects like https://0.0.0.0:3434/login. nginx sets
 * X-Forwarded-Proto/Host (and forwards the real Host), so trust those instead.
 */
export function publicLoginUrl(req: NextRequest): URL {
  const xfProto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const host =
    req.headers.get("x-forwarded-host")?.split(",")[0].trim() ||
    req.headers.get("host") ||
    "leads.mongodb.help";
  const proto = xfProto || (host.startsWith("localhost") ? "http" : "https");
  return new URL("/login", `${proto}://${host}`);
}

function secret(): Uint8Array {
  const s = process.env.ADMIN_SECRET;
  if (!s) throw new Error("ADMIN_SECRET is not set");
  return new TextEncoder().encode(s);
}

/** Mint a 7-day admin session JWT (sub=admin, HS256). */
export async function signAdminToken(): Promise<string> {
  return new SignJWT()
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject("admin")
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

/** Verify a token is a valid admin session. Returns false on any failure. */
export async function verifyAdminToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return payload.sub === "admin";
  } catch {
    return false;
  }
}
