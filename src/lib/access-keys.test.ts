import { describe, it, expect, beforeAll } from "vitest";
import { encryptSecret, decryptSecret, secretsMatch, keyUsable } from "./access-keys";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-for-access-keys-please-change";
});

describe("加解密往返", () => {
  it("decrypt(encrypt(x)) === x", () => {
    const plain = "Hunter2-密钥-✓";
    expect(decryptSecret(encryptSecret(plain))).toBe(plain);
  });

  it("两次加密同一明文得到不同密文（随机 IV）", () => {
    expect(encryptSecret("abc")).not.toBe(encryptSecret("abc"));
  });

  it("篡改密文导致解密抛错", () => {
    const enc = encryptSecret("abc");
    const bad = enc.slice(0, -2) + (enc.endsWith("A") ? "B" : "A");
    expect(() => decryptSecret(bad)).toThrow();
  });
});

describe("secretsMatch", () => {
  it("相同返回 true", () => expect(secretsMatch("abc", "abc")).toBe(true));
  it("不同返回 false", () => expect(secretsMatch("abc", "abd")).toBe(false));
  it("长度不同返回 false", () => expect(secretsMatch("abc", "abcd")).toBe(false));
});

describe("keyUsable", () => {
  const now = new Date("2026-06-26T00:00:00Z");
  it("active + 无限制 → true", () =>
    expect(keyUsable({ active: true, validUntil: null, maxUses: null, usedCount: 99 }, now)).toBe(true));
  it("停用 → false", () =>
    expect(keyUsable({ active: false, validUntil: null, maxUses: null, usedCount: 0 }, now)).toBe(false));
  it("已过期 → false", () =>
    expect(keyUsable({ active: true, validUntil: new Date("2026-06-25T00:00:00Z"), maxUses: null, usedCount: 0 }, now)).toBe(false));
  it("未到期 → true", () =>
    expect(keyUsable({ active: true, validUntil: new Date("2026-06-27T00:00:00Z"), maxUses: null, usedCount: 0 }, now)).toBe(true));
  it("用尽次数 → false", () =>
    expect(keyUsable({ active: true, validUntil: null, maxUses: 5, usedCount: 5 }, now)).toBe(false));
  it("未用尽 → true", () =>
    expect(keyUsable({ active: true, validUntil: null, maxUses: 5, usedCount: 4 }, now)).toBe(true));
});
