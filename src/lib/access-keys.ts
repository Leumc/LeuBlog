// 访问许可密钥的加解密与有效性判断。
// 不加 "server-only"：本模块为纯逻辑，便于单元测试；仅被服务端代码引用。
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "crypto";

/** 由 AUTH_SECRET 派生 32 字节对称密钥 */
function aesKey(): Buffer {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET 未配置");
  return createHash("sha256").update(s).digest();
}

/** AES-256-GCM 加密，返回 "ivB64.tagB64.ctB64" */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", aesKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${ct.toString("base64")}`;
}

/** 解密 "ivB64.tagB64.ctB64"；密文被篡改会抛错 */
export function decryptSecret(enc: string): string {
  const [ivB64, tagB64, ctB64] = enc.split(".");
  const decipher = createDecipheriv("aes-256-gcm", aesKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]);
  return pt.toString("utf8");
}

/** 定长 timing-safe 字符串比较 */
export function secretsMatch(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export type KeyValidity = {
  active: boolean;
  validUntil: Date | null;
  maxUses: number | null;
  usedCount: number;
};

/** 密钥当前是否可用（启用 / 未过期 / 未用尽） */
export function keyUsable(k: KeyValidity, now: Date): boolean {
  if (!k.active) return false;
  if (k.validUntil && k.validUntil.getTime() <= now.getTime()) return false;
  if (k.maxUses !== null && k.usedCount >= k.maxUses) return false;
  return true;
}
