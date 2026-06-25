import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

const COOKIE = "leublog_session";
const ALG = "HS256";

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET 未配置");
  return new TextEncoder().encode(s);
}

export type SessionUser = {
  id: string;
  username: string;
  displayName: string;
  role: Role;
};

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** 校验凭据并返回用户（不存在/禁用/密码错均返回 null） */
export async function authenticate(
  identifier: string,
  password: string,
): Promise<SessionUser | null> {
  const id = identifier.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: {
      active: true,
      OR: [{ email: id }, { username: identifier.trim() }],
    },
  });
  if (!user) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  };
}

/** 写入会话 cookie */
export async function createSession(user: SessionUser, remember: boolean): Promise<void> {
  const maxAge = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 12; // 30 天 / 12 小时
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    // 仅当显式启用 HTTPS 时才加 Secure 标志。
    // 默认 false：否则在 HTTP（无 TLS）部署下浏览器会拒绝存储 Secure cookie，
    // 导致登录后 cookie 丢失、每次跳回登录页。配了 HTTPS 后设 COOKIE_SECURE=true。
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

/** 从 cookie 读取当前会话用户（无效返回 null） */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      id: payload.id as string,
      username: payload.username as string,
      displayName: payload.displayName as string,
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

/** 在 Edge 中间件里校验 token（仅判断是否有效 + 取 role） */
export async function verifyTokenEdge(
  token: string | undefined,
): Promise<{ role: Role } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { role: payload.role as Role };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = COOKIE;
