import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { cookieName, publicLoginUrl } from "@/lib/admin-session";

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(cookieName())?.value;
  let ok = false;
  if (token && process.env.ADMIN_SECRET) {
    try {
      const secret = new TextEncoder().encode(process.env.ADMIN_SECRET);
      const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
      ok = payload.sub === "admin";
    } catch {
      ok = false;
    }
  }
  if (!ok) {
    return NextResponse.redirect(publicLoginUrl(req));
  }
  return NextResponse.next();
}

// Gate everything except the login page and API routes (the gateway does its
// own token check).
export const config = {
  matcher: ["/((?!login|api|_next/static|_next/image|favicon.ico).*)"],
};
