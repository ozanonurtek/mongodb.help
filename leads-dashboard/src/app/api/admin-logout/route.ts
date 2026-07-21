import { NextResponse, type NextRequest } from "next/server";
import { cookieName, publicLoginUrl } from "@/lib/admin-session";

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(publicLoginUrl(req), { status: 303 });
  res.cookies.delete(cookieName());
  return res;
}
