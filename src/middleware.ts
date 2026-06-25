import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifyToken } from "@/lib/edge-auth";

const ADMIN_ONLY = [
  "/admin/announcements",
  "/admin/portals",
  "/admin/media",
  "/admin/taxonomy",
  "/admin/users",
  "/admin/settings",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 登录页放行
  if (pathname === "/admin/login") return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifyToken(token);

  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // 仅管理员可访问的运营/系统页
  if (session.role !== "ADMIN" && ADMIN_ONLY.some((p) => pathname.startsWith(p))) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
