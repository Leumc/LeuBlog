import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const COOKIE = "leublog_unlocks";
const WEEK = 60 * 60 * 24 * 7;
const ALG = "HS256";

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET 未配置");
  return new TextEncoder().encode(s);
}

export type UnlockEntry = { e: number; k: string };
export type UnlockMap = Record<string, UnlockEntry>;

/** 去掉已过期项（e <= nowSec） */
export function filterActive(map: UnlockMap, nowSec: number): UnlockMap {
  const out: UnlockMap = {};
  for (const [pid, v] of Object.entries(map)) {
    if (v && typeof v.e === "number" && v.e > nowSec) out[pid] = v;
  }
  return out;
}

/** 合并新解锁（覆盖已有项的到期与 keyId），返回新对象 */
export function mergeGrants(
  existing: UnlockMap,
  postIds: string[],
  keyId: string,
  expirySec: number,
): UnlockMap {
  const out: UnlockMap = { ...existing };
  for (const pid of postIds) out[pid] = { e: expirySec, k: keyId };
  return out;
}

/** 读取当前有效的解锁表 */
export async function readUnlocks(): Promise<UnlockMap> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return {};
  try {
    const { payload } = await jwtVerify(token, secret());
    const map = (payload.u as UnlockMap) || {};
    return filterActive(map, Math.floor(Date.now() / 1000));
  } catch {
    return {};
  }
}

export async function isUnlocked(postId: string): Promise<boolean> {
  const m = await readUnlocks();
  return Boolean(m[postId]);
}

/** 把 postIds 标记为已解锁（7 天），并记录所用 keyId */
export async function grantUnlocks(postIds: string[], keyId: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const merged = mergeGrants(await readUnlocks(), postIds, keyId, now + WEEK);
  const token = await new SignJWT({ u: merged })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${WEEK}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    path: "/",
    maxAge: WEEK,
  });
}
