import { jwtVerify } from "jose";

/** Edge 中间件用：仅依赖 jose，不引入 prisma/bcrypt */
export const SESSION_COOKIE = "leublog_session";

export async function verifyToken(
  token: string | undefined,
): Promise<{ id: string; role: "ADMIN" | "EDITOR" } | null> {
  if (!token) return null;
  const s = process.env.AUTH_SECRET;
  if (!s) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(s));
    return { id: payload.id as string, role: payload.role as "ADMIN" | "EDITOR" };
  } catch {
    return null;
  }
}
