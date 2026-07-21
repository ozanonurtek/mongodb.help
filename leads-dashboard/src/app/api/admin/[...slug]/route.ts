import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken, cookieName } from "@/lib/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8888";

async function gateway(
  req: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await context.params;
  const path = "/api/admin/" + slug.join("/");
  const search = req.nextUrl.search;

  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName())?.value;
  if (!(await verifyAdminToken(token))) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("content-length");
  headers.set("X-Admin-Token", token as string);

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
    return NextResponse.json(
      { detail: "Backend unreachable" },
      { status: 502 }
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
export const PATCH = gateway;
export const PUT = gateway;
export const DELETE = gateway;
