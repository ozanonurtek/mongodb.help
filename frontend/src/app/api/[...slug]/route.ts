import { NextRequest } from "next/server";
import { createHmac } from "crypto";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8888";

// Shared secret between this gateway and the backend. The gateway proves
// each user-id assertion by HMAC-signing (method, path, user_id, ts) with
// this secret; the backend trusts X-Auth-User-Id ONLY when X-Gateway-Sig
// verifies. Direct backend access without the secret cannot impersonate a
// user. Must be set to the same value on frontend and backend.
//
// Rotation: changing the secret causes a ~60s blip where signed-in users
// are downgraded to anonymous (one service has the new value, the other
// still has the old). No deploy order avoids this with a single secret;
// no data is lost, users just need to refresh after both services are
// redeployed.
const GATEWAY_HMAC_SECRET = process.env.GATEWAY_HMAC_SECRET;

function signGateway(
  method: string,
  path: string,
  userId: string,
  ts: number,
): string {
  if (!GATEWAY_HMAC_SECRET) {
    throw new Error("GATEWAY_HMAC_SECRET is not set");
  }
  // Keep this format in sync with backend/app/identity.py:_verify_gateway_sig.
  const message = [method, path, userId, String(ts)].join("\n");
  return createHmac("sha256", GATEWAY_HMAC_SECRET)
    .update(message)
    .digest("hex");
}

async function gateway(req: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await context.params;
  const path = "/api/" + slug.join("/");
  const search = req.nextUrl.search;

  const session = await auth();

  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("content-length");
  // Never trust client-supplied identity/gateway headers — only this
  // gateway sets them. An attacker cannot forge a valid X-Gateway-Sig
  // without GATEWAY_HMAC_SECRET.
  headers.delete("x-auth-user-id");
  headers.delete("x-auth-role");
  headers.delete("x-gateway-sig");
  headers.delete("x-gateway-ts");

  const userId = session?.user?.id;
  if (userId && GATEWAY_HMAC_SECRET) {
    const ts = Math.floor(Date.now() / 1000);
    headers.set("X-Auth-User-Id", userId);
    headers.set("X-Gateway-Sig", signGateway(req.method, path, userId, ts));
    headers.set("X-Gateway-Ts", String(ts));
    const role = (session.user as { role?: string }).role;
    if (role) headers.set("X-Auth-Role", role);
  }
  // If GATEWAY_HMAC_SECRET is unset on the gateway we intentionally send no
  // identity headers: the backend will treat the caller as anonymous. This
  // is fail-safe (signed-in features degrade) rather than fail-open.

  const hasBody = !["GET", "HEAD"].includes(req.method);
  const body = hasBody ? await req.arrayBuffer() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND_URL}${path}${search}`, {
      method: req.method,
      headers,
      body,
      redirect: "manual",
    });
  } catch {
    return new Response(
      JSON.stringify({ detail: "Backend unreachable" }),
      { status: 502, headers: { "content-type": "application/json" } },
    );
  }

  const respHeaders = new Headers(upstream.headers);
  respHeaders.delete("content-encoding");
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
}

export const GET = gateway;
export const POST = gateway;
export const PUT = gateway;
export const PATCH = gateway;
export const DELETE = gateway;
export const HEAD = gateway;
export const OPTIONS = gateway;
