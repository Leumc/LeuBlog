# 文章访问许可密钥 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让管理员给文章上锁、配置访问许可密钥，读者输入正确密钥后解锁阅读，解锁状态存浏览器 cookie 保持 7 天。

**Architecture:** 服务端门禁——文章被锁且读者未解锁时服务器不渲染正文，只下发标题/摘要/说明。密钥明文用 AES-256-GCM（密钥派生自 `AUTH_SECRET`）可逆加密存库，后台可解密查看。解锁状态存于 jose 签名的 `leublog_unlocks` cookie，按文章独立计时 7 天。上锁与密钥管理严格限 ADMIN。

**Tech Stack:** Next.js 15 App Router、Prisma + SQLite、jose（JWT 签名）、Node `crypto`（AES-GCM）、Vitest（新增，仅测纯逻辑）。

## Global Constraints

- 自建 JWT 会话，**不使用 NextAuth**。会话/cookie 用 `jose` + `AUTH_SECRET`（HS256），加解密用 `AUTH_SECRET` 派生密钥。两处必须用同一个 `AUTH_SECRET`。
- cookie 一律 `httpOnly`、`sameSite: "lax"`、`path: "/"`、`secure: process.env.COOKIE_SECURE === "true"`（HTTP 部署下不能强加 Secure）。
- 上锁（`Post.locked` / `Post.gateNote`）与密钥管理**仅 ADMIN**；EDITOR 无权限，提交相关字段一律忽略。
- 密钥可逆存储，后台可查看明文。
- 解锁语义：一次成功兑换 = `usedCount` +1，并把该密钥覆盖的全部已发布文章一次性写入解锁 cookie（整体计 1 次）。
- 解锁状态保持 **7 天**（`60*60*24*7` 秒），逐篇独立计时。
- TypeScript 严格；新文件遵循现有风格（中文注释、`String(formData.get(...))` 取值、Server Action `requireAdmin()`/`requireUser()` 守卫）。
- 失败信息统一为「密钥错误或已失效」，不泄露具体失败原因。

---

### Task 1: Vitest 接入 + 密钥加解密库（TDD）

**Files:**
- Modify: `package.json`（加 `vitest` devDep 与 `test` 脚本）
- Create: `vitest.config.ts`
- Create: `src/lib/access-keys.ts`
- Test: `src/lib/access-keys.test.ts`

**Interfaces:**
- Produces:
  - `encryptSecret(plain: string): string` — 返回 `"ivB64.tagB64.ctB64"`
  - `decryptSecret(enc: string): string`
  - `secretsMatch(a: string, b: string): boolean` — 定长 timing-safe 比较
  - `type KeyValidity = { active: boolean; validUntil: Date | null; maxUses: number | null; usedCount: number }`
  - `keyUsable(k: KeyValidity, now: Date): boolean`

- [ ] **Step 1: 安装 vitest**

Run: `npm install -D vitest@^2`
Expected: 安装成功，`package.json` devDependencies 出现 `vitest`。

- [ ] **Step 2: 加 test 脚本**

修改 `package.json` 的 `scripts`，加入：

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: 写 vitest 配置**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: 写失败测试**

Create `src/lib/access-keys.test.ts`:

```ts
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
```

- [ ] **Step 5: 运行测试，确认失败**

Run: `npm test`
Expected: FAIL，报 `access-keys` 模块或导出不存在。

- [ ] **Step 6: 写实现**

Create `src/lib/access-keys.ts`:

```ts
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
```

- [ ] **Step 7: 运行测试，确认通过**

Run: `npm test`
Expected: PASS，全部用例绿。

- [ ] **Step 8: 提交**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/access-keys.ts src/lib/access-keys.test.ts
git commit -m "feat: 密钥加解密库 + vitest 接入"
```

---

### Task 2: Prisma 模型 —— Post.locked/gateNote + AccessKey + 迁移

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `Post.locked: Boolean`、`Post.gateNote: String?`、模型 `AccessKey`（字段见下）、多对多关系 `KeyPosts`。

- [ ] **Step 1: 给 Post 加字段与反向关系**

在 `prisma/schema.prisma` 的 `model Post` 内，`viewCount` 行后加：

```prisma
  locked      Boolean    @default(false)
  gateNote    String?    // 解锁界面展示的文章级说明
```

在 `model Post` 的关系区（`tags Tag[] @relation("PostTags")` 之后）加：

```prisma
  accessKeys AccessKey[] @relation("KeyPosts")
```

- [ ] **Step 2: 新增 AccessKey 模型**

在 `prisma/schema.prisma` 末尾追加：

```prisma
// 文章访问许可密钥
model AccessKey {
  id         String    @id @default(cuid())
  label      String?   // 后台备注名
  secretEnc  String    // AES-256-GCM 加密后的密钥明文
  note       String?   // 密钥级说明（解锁成功后展示）
  maxUses    Int?      // 最大使用次数，null=不限
  usedCount  Int       @default(0)
  validUntil DateTime? // 有效截止，null=不过期
  active     Boolean   @default(true)
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  posts Post[] @relation("KeyPosts")

  @@index([active])
}
```

- [ ] **Step 3: 生成并应用迁移**

Run: `npx prisma migrate dev --name access_keys`
Expected: 新建迁移文件，SQLite 应用成功，Prisma Client 重新生成无误。

- [ ] **Step 4: 类型校验**

Run: `npx tsc --noEmit`
Expected: 无新增类型错误（此时尚无引用新字段的代码）。

- [ ] **Step 5: 提交**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: Post 上锁字段 + AccessKey 模型与迁移"
```

---

### Task 3: 解锁状态 cookie 库（TDD 纯逻辑 + cookie I/O）

**Files:**
- Create: `src/lib/unlock-cookie.ts`
- Test: `src/lib/unlock-cookie.test.ts`

**Interfaces:**
- Consumes: `process.env.AUTH_SECRET`、`next/headers` 的 `cookies()`、`jose`。
- Produces:
  - `type UnlockEntry = { e: number; k: string }`（`e`=到期 epoch 秒，`k`=keyId）
  - `type UnlockMap = Record<string, UnlockEntry>`
  - `filterActive(map: UnlockMap, nowSec: number): UnlockMap`（纯）
  - `mergeGrants(existing: UnlockMap, postIds: string[], keyId: string, expirySec: number): UnlockMap`（纯）
  - `readUnlocks(): Promise<UnlockMap>`（已过滤过期）
  - `isUnlocked(postId: string): Promise<boolean>`
  - `grantUnlocks(postIds: string[], keyId: string): Promise<void>`

- [ ] **Step 1: 写失败测试（纯逻辑）**

Create `src/lib/unlock-cookie.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { filterActive, mergeGrants, type UnlockMap } from "./unlock-cookie";

describe("filterActive", () => {
  it("过滤掉已过期项", () => {
    const map: UnlockMap = {
      a: { e: 100, k: "k1" },
      b: { e: 300, k: "k1" },
    };
    expect(filterActive(map, 200)).toEqual({ b: { e: 300, k: "k1" } });
  });
  it("到期时间等于 now 视为过期", () => {
    expect(filterActive({ a: { e: 200, k: "k1" } }, 200)).toEqual({});
  });
});

describe("mergeGrants", () => {
  it("新增并覆盖已有项的到期与 keyId", () => {
    const existing: UnlockMap = { a: { e: 100, k: "old" } };
    const out = mergeGrants(existing, ["a", "b"], "new", 999);
    expect(out).toEqual({
      a: { e: 999, k: "new" },
      b: { e: 999, k: "new" },
    });
  });
  it("不修改入参对象", () => {
    const existing: UnlockMap = { a: { e: 100, k: "old" } };
    mergeGrants(existing, ["b"], "new", 999);
    expect(existing).toEqual({ a: { e: 100, k: "old" } });
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test -- unlock-cookie`
Expected: FAIL，模块/导出不存在。

- [ ] **Step 3: 写实现**

Create `src/lib/unlock-cookie.ts`:

```ts
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
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm test -- unlock-cookie`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/lib/unlock-cookie.ts src/lib/unlock-cookie.test.ts
git commit -m "feat: 解锁状态 cookie 库"
```

---

### Task 4: 解锁 Server Action

**Files:**
- Create: `src/app/(reading)/posts/[slug]/unlock-actions.ts`

**Interfaces:**
- Consumes: `decryptSecret`、`secretsMatch`、`keyUsable`（Task 1）、`grantUnlocks`（Task 3）、`prisma`。
- Produces:
  - `type UnlockState = { error?: string }`
  - `unlockPostAction(prev: UnlockState, formData: FormData): Promise<UnlockState>` — 供 `useActionState` 使用；成功时 `redirect` 回文章页（不返回），失败返回 `{ error }`。

- [ ] **Step 1: 写实现**

Create `src/app/(reading)/posts/[slug]/unlock-actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { decryptSecret, secretsMatch, keyUsable } from "@/lib/access-keys";
import { grantUnlocks } from "@/lib/unlock-cookie";

export type UnlockState = { error?: string };

const FAIL = "密钥错误或已失效";

export async function unlockPostAction(
  _prev: UnlockState,
  formData: FormData,
): Promise<UnlockState> {
  const slug = String(formData.get("slug") || "");
  const entered = String(formData.get("key") || "").trim();
  if (!slug || !entered) return { error: "请输入密钥" };

  const post = await prisma.post.findFirst({
    where: { slug, status: "PUBLISHED", locked: true },
    select: { id: true },
  });
  if (!post) return { error: FAIL };

  // 覆盖本文且启用的候选密钥
  const candidates = await prisma.accessKey.findMany({
    where: { active: true, posts: { some: { id: post.id } } },
    include: { posts: { where: { status: "PUBLISHED" }, select: { id: true } } },
  });

  const now = new Date();
  const match = candidates.find(
    (k) => keyUsable(k, now) && secretsMatch(decryptSecret(k.secretEnc), entered),
  );
  if (!match) return { error: FAIL };

  // 条件式原子自增，防并发超出 maxUses
  const upd = await prisma.accessKey.updateMany({
    where:
      match.maxUses === null
        ? { id: match.id }
        : { id: match.id, usedCount: { lt: match.maxUses } },
    data: { usedCount: { increment: 1 } },
  });
  if (upd.count === 0) return { error: FAIL };

  // 一次兑换解锁该密钥覆盖的全部已发布文章
  await grantUnlocks(match.posts.map((p) => p.id), match.id);

  redirect(`/posts/${slug}`); // 抛出 NEXT_REDIRECT，结束 action
}
```

- [ ] **Step 2: 类型校验**

Run: `npx tsc --noEmit`
Expected: 无错误。

- [ ] **Step 3: 提交**

```bash
git add "src/app/(reading)/posts/[slug]/unlock-actions.ts"
git commit -m "feat: 解锁 Server Action"
```

---

### Task 5: ArticleGate 组件 + 文章页门禁集成 + 样式

**Files:**
- Create: `src/components/reader/ArticleGate.tsx`
- Modify: `src/app/(reading)/posts/[slug]/page.tsx`
- Modify: `src/styles/globals.css`（追加门禁样式）

**Interfaces:**
- Consumes: `unlockPostAction`/`UnlockState`（Task 4）、`readUnlocks`（Task 3）、`prisma`。
- Produces: `ArticleGate` 默认导出，props `{ slug: string; title: string; note: string | null }`。

- [ ] **Step 1: 写 ArticleGate 组件**

Create `src/components/reader/ArticleGate.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { unlockPostAction, type UnlockState } from "@/app/(reading)/posts/[slug]/unlock-actions";

export default function ArticleGate({
  slug,
  title,
  note,
}: {
  slug: string;
  title: string;
  note: string | null;
}) {
  const [state, formAction, pending] = useActionState<UnlockState, FormData>(
    unlockPostAction,
    {},
  );

  return (
    <div className="wrap gate">
      <div className="gate-lock">🔒</div>
      <h1>{title}</h1>
      <div className="gate-note">
        {note ? note : "本文需要访问许可密钥才能阅读。"}
      </div>
      <form action={formAction} className="gate-form">
        <input type="hidden" name="slug" value={slug} />
        <input
          type="password"
          name="key"
          placeholder="输入访问许可密钥"
          autoComplete="off"
          autoFocus
        />
        <button type="submit" className="btn primary" disabled={pending}>
          {pending ? "校验中…" : "解锁阅读"}
        </button>
        {state.error && <p className="gate-err">{state.error}</p>}
      </form>
    </div>
  );
}
```

- [ ] **Step 2: 文章页集成门禁**

Modify `src/app/(reading)/posts/[slug]/page.tsx`：

在文件顶部 import 区加：

```tsx
import ArticleGate from "@/components/reader/ArticleGate";
import { readUnlocks } from "@/lib/unlock-cookie";
```

在 `if (!post) notFound();` 之后、`const html = ...` 之前插入：

```tsx
  // 访问许可门禁：上锁且未解锁 → 不渲染正文，仅展示密钥输入界面
  const unlocks = await readUnlocks();
  const entry = unlocks[post.id];
  if (post.locked && !entry) {
    return <ArticleGate slug={post.slug} title={post.title} note={post.gateNote} />;
  }
  // 已解锁：若解锁所用密钥有说明，正文顶部展示
  let keyNote: string | null = null;
  if (post.locked && entry) {
    const k = await prisma.accessKey.findUnique({
      where: { id: entry.k },
      select: { note: true },
    });
    keyNote = k?.note ?? null;
  }
```

在 `<article>` 开标签之后、`<div className="post-crumb">` 之前插入横幅：

```tsx
        {keyNote && <div className="key-note">{keyNote}</div>}
```

- [ ] **Step 3: 追加样式**

在 `src/styles/globals.css` 末尾追加：

```css
/* 访问许可门禁 */
.gate {
  max-width: 640px;
  padding: 60px 0 80px;
  text-align: center;
}
.gate .gate-lock {
  font-size: 40px;
  margin-bottom: 12px;
}
.gate h1 {
  font-size: 26px;
  margin: 0 0 18px;
}
.gate-note {
  white-space: pre-line;
  text-align: left;
  color: var(--soft);
  background: var(--card, rgba(127, 127, 127, 0.06));
  border: 1px solid var(--aline, rgba(127, 127, 127, 0.2));
  border-radius: 8px;
  padding: 16px 18px;
  margin-bottom: 22px;
  line-height: 1.7;
}
.gate-form {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
}
.gate-form input[type="password"] {
  flex: 1;
  min-width: 220px;
  max-width: 360px;
  padding: 9px 12px;
  border: 1px solid var(--aline, rgba(127, 127, 127, 0.3));
  border-radius: 6px;
  font-size: 15px;
}
.gate-err {
  flex-basis: 100%;
  color: #c0392b;
  font-size: 13px;
  margin: 4px 0 0;
}
.key-note {
  white-space: pre-line;
  background: var(--card, rgba(127, 127, 127, 0.06));
  border: 1px solid var(--aline, rgba(127, 127, 127, 0.2));
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 18px;
  font-size: 14px;
  color: var(--soft);
}
```

- [ ] **Step 4: 构建校验**

Run: `npm run build`
Expected: 构建成功，无类型/编译错误。

- [ ] **Step 5: 提交**

```bash
git add "src/components/reader/ArticleGate.tsx" "src/app/(reading)/posts/[slug]/page.tsx" src/styles/globals.css
git commit -m "feat: 文章门禁界面与集成"
```

---

### Task 6: 文章编辑器上锁面板 + 编辑/新建页 + 仅管理员持久化

**Files:**
- Modify: `src/components/admin/PostEditor.tsx`
- Modify: `src/app/admin/posts/post-actions.ts`
- Modify: `src/app/admin/posts/[id]/edit/page.tsx`
- Modify: `src/app/admin/posts/new/page.tsx`

**Interfaces:**
- Consumes: 现有 `persistPost` 管线、`getSessionUser`。
- Produces: `EditorPost` 增加 `locked: boolean; gateNote: string`；`PostEditor` 增加 prop `canLock: boolean`。

- [ ] **Step 1: 扩展 EditorPost 类型与 props**

Modify `src/components/admin/PostEditor.tsx`：

`EditorPost` 类型加两字段（`tagIds: string[];` 之后）：

```tsx
  locked: boolean;
  gateNote: string;
```

组件签名加 `canLock`：

```tsx
export default function PostEditor({
  post,
  categories,
  taxonomy,
  canLock,
}: {
  post: EditorPost;
  categories: { id: string; name: string }[];
  taxonomy: Taxonomy;
  canLock: boolean;
}) {
```

在现有 `useState` 区（`const [tagIds, ...]` 附近）加：

```tsx
  const [locked, setLocked] = useState(post.locked);
  const [gateNote, setGateNote] = useState(post.gateNote);
```

- [ ] **Step 2: 提交上锁字段（仅管理员渲染）**

在 `<form action={savePostAsDraft}>` 内的隐藏字段区（`<input type="hidden" name="excerpt" ... />` 之后）加：

```tsx
      {canLock && <input type="hidden" name="locked" value={locked ? "true" : "false"} />}
      {canLock && <input type="hidden" name="gateNote" value={gateNote} />}
```

- [ ] **Step 3: 加「访问控制」面板**

在标签选择 `<div className="panel">…</div>`（文件末尾 `</form>` 之前）之后加：

```tsx
      {canLock && (
        <div className="panel">
          <div className="h">
            <h2>访问控制</h2>
          </div>
          <div className="b">
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={locked}
                onChange={(e) => setLocked(e.target.checked)}
              />
              给本文上锁（需输入密钥才能阅读）
            </label>
            <div className="fld" style={{ marginTop: 12, maxWidth: 520 }}>
              <label>解锁界面说明（文章概要 / 为什么上锁 / 密钥获取途径）</label>
              <textarea
                value={gateNote}
                onChange={(e) => setGateNote(e.target.value)}
                rows={4}
              />
            </div>
            <p style={{ fontSize: 12, color: "var(--amuted)", marginTop: 8 }}>
              密钥在「访问密钥」页管理。上锁但无任何启用密钥覆盖的文章，读者将无法解锁。
            </p>
          </div>
        </div>
      )}
```

- [ ] **Step 4: 持久化层仅管理员采纳 locked/gateNote**

Modify `src/app/admin/posts/post-actions.ts` 的 `persistPost`：

在 `const tagIds = JSON.parse(...)` 之后加：

```ts
  const isAdmin = user.role === "ADMIN";
  const lockFields = isAdmin
    ? {
        locked: formData.get("locked") === "true",
        gateNote: String(formData.get("gateNote") || "").trim() || null,
      }
    : {};
```

在 `prisma.post.update({ ... data: {` 块内，`tags: { set: ... },` 之后加：

```ts
        ...lockFields,
```

在 `prisma.post.create({ ... data: {` 块内，`tags: { connect: ... },` 之后加：

```ts
        ...lockFields,
```

- [ ] **Step 5: 编辑页传 canLock 与现值**

Modify `src/app/admin/posts/[id]/edit/page.tsx`，给 `<PostEditor post={{...}}>` 的对象加两字段（`tagIds` 之后）：

```tsx
        locked: post.locked,
        gateNote: post.gateNote ?? "",
```

并加 prop：

```tsx
      canLock={user.role === "ADMIN"}
```

- [ ] **Step 6: 新建页传 canLock 与默认值**

Modify `src/app/admin/posts/new/page.tsx`：

import 区加：

```tsx
import { getSessionUser } from "@/lib/auth";
```

组件体改为：

```tsx
export default async function NewPostPage() {
  const user = (await getSessionUser())!;
  const { categories, taxonomy } = await getEditorTaxonomy();
  return (
    <PostEditor
      post={{
        title: "",
        slug: "",
        excerpt: "",
        content: "",
        status: "DRAFT",
        categoryId: null,
        tagIds: [],
        locked: false,
        gateNote: "",
      }}
      categories={categories}
      taxonomy={taxonomy}
      canLock={user.role === "ADMIN"}
    />
  );
}
```

- [ ] **Step 7: 构建校验**

Run: `npm run build`
Expected: 构建成功。

- [ ] **Step 8: 提交**

```bash
git add src/components/admin/PostEditor.tsx src/app/admin/posts/post-actions.ts "src/app/admin/posts/[id]/edit/page.tsx" src/app/admin/posts/new/page.tsx
git commit -m "feat: 文章编辑器上锁面板（仅管理员）"
```

---

### Task 7: 访问密钥后台 —— 路由/导航/权限接入 + Server Actions

**Files:**
- Modify: `src/middleware.ts`
- Modify: `src/lib/permissions.ts`
- Create: `src/app/admin/access-keys/actions.ts`

**Interfaces:**
- Consumes: `requireAdmin`、`encryptSecret`、`prisma`。
- Produces: `createAccessKey`、`updateAccessKey`、`deleteAccessKey`、`resetUsage`（均 `(formData: FormData) => Promise<void>`）。

- [ ] **Step 1: 中间件加管理员专属前缀**

Modify `src/middleware.ts`，`ADMIN_ONLY` 数组加一行：

```ts
  "/admin/access-keys",
```

- [ ] **Step 2: 权限前缀与导航**

Modify `src/lib/permissions.ts`：

`ADMIN_ONLY_PREFIXES` 数组加：

```ts
  "/admin/access-keys",
```

`navForRole` 的「系统」组（ADMIN 分支，`items` 数组内）加入口：

```ts
        { label: "访问密钥", href: "/admin/access-keys", icon: "🔒" },
```

- [ ] **Step 3: 写 Server Actions**

Create `src/app/admin/access-keys/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { encryptSecret } from "@/lib/access-keys";

function parsePostIds(fd: FormData): string[] {
  return fd.getAll("postIds").map(String).filter(Boolean);
}

function parseMaxUses(v: FormDataEntryValue | null): number | null {
  const s = String(v || "").trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseValidUntil(v: FormDataEntryValue | null): Date | null {
  const s = String(v || "").trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export async function createAccessKey(formData: FormData): Promise<void> {
  await requireAdmin();
  const secret = String(formData.get("secret") || "").trim();
  if (!secret) return;
  await prisma.accessKey.create({
    data: {
      label: String(formData.get("label") || "").trim() || null,
      secretEnc: encryptSecret(secret),
      note: String(formData.get("note") || "").trim() || null,
      maxUses: parseMaxUses(formData.get("maxUses")),
      validUntil: parseValidUntil(formData.get("validUntil")),
      active: formData.get("active") === "on",
      posts: { connect: parsePostIds(formData).map((id) => ({ id })) },
    },
  });
  revalidatePath("/admin/access-keys");
  redirect("/admin/access-keys");
}

export async function updateAccessKey(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;
  const secret = String(formData.get("secret") || "").trim();
  await prisma.accessKey.update({
    where: { id },
    data: {
      label: String(formData.get("label") || "").trim() || null,
      ...(secret ? { secretEnc: encryptSecret(secret) } : {}),
      note: String(formData.get("note") || "").trim() || null,
      maxUses: parseMaxUses(formData.get("maxUses")),
      validUntil: parseValidUntil(formData.get("validUntil")),
      active: formData.get("active") === "on",
      posts: { set: parsePostIds(formData).map((id) => ({ id })) },
    },
  });
  revalidatePath("/admin/access-keys");
  redirect("/admin/access-keys");
}

export async function deleteAccessKey(formData: FormData): Promise<void> {
  await requireAdmin();
  await prisma.accessKey.delete({ where: { id: String(formData.get("id") || "") } });
  revalidatePath("/admin/access-keys");
}

export async function resetUsage(formData: FormData): Promise<void> {
  await requireAdmin();
  await prisma.accessKey.update({
    where: { id: String(formData.get("id") || "") },
    data: { usedCount: 0 },
  });
  revalidatePath("/admin/access-keys");
}
```

> 注意：`active` 复选框未勾选时浏览器不提交该字段，故用 `=== "on"` 判断；表单需保证新建时默认勾选（见 Task 8）。

- [ ] **Step 4: 类型校验**

Run: `npx tsc --noEmit`
Expected: 无错误。

- [ ] **Step 5: 提交**

```bash
git add src/middleware.ts src/lib/permissions.ts src/app/admin/access-keys/actions.ts
git commit -m "feat: 访问密钥后台路由/权限/动作"
```

---

### Task 8: 访问密钥后台页面与表单

**Files:**
- Create: `src/components/admin/AccessKeyForm.tsx`
- Create: `src/app/admin/access-keys/page.tsx`

**Interfaces:**
- Consumes: `createAccessKey`/`updateAccessKey`/`deleteAccessKey`/`resetUsage`（Task 7）、`decryptSecret`（Task 1）、`prisma`。
- Produces: `AccessKeyForm`（client 表单，新建/编辑复用）。

- [ ] **Step 1: 写表单组件**

Create `src/components/admin/AccessKeyForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { createAccessKey, updateAccessKey } from "@/app/admin/access-keys/actions";

export type PostOption = { id: string; title: string };

export type AccessKeyInit = {
  id: string;
  label: string;
  secret: string;
  note: string;
  maxUses: string; // "" = 不限
  validUntil: string; // datetime-local 值，"" = 不过期
  active: boolean;
  postIds: string[];
};

const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 去掉易混字符

function randomSecret(len = 10): string {
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => CHARSET[n % CHARSET.length]).join("");
}

export default function AccessKeyForm({
  init,
  posts,
}: {
  init?: AccessKeyInit;
  posts: PostOption[];
}) {
  const editing = Boolean(init?.id);
  const [secret, setSecret] = useState(init?.secret ?? "");
  const [reveal, setReveal] = useState(false);
  const [postIds, setPostIds] = useState<string[]>(init?.postIds ?? []);

  const toggle = (id: string) =>
    setPostIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <form action={editing ? updateAccessKey : createAccessKey} className="b">
      {editing && <input type="hidden" name="id" value={init!.id} />}

      <div className="fld" style={{ maxWidth: 420 }}>
        <label>备注名（可空）</label>
        <input name="label" defaultValue={init?.label ?? ""} placeholder="便于识别，如「内测读者」" />
      </div>

      <div className="fld" style={{ maxWidth: 520 }}>
        <label>密钥</label>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            name="secret"
            type={reveal ? "text" : "password"}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={editing ? "留空则不修改" : "自定义或点击生成"}
            autoComplete="off"
            style={{ flex: 1, minWidth: 200 }}
          />
          <button type="button" className="btn sm" onClick={() => setReveal((r) => !r)}>
            {reveal ? "隐藏" : "显示"}
          </button>
          <button type="button" className="btn sm" onClick={() => { setSecret(randomSecret()); setReveal(true); }}>
            生成
          </button>
        </div>
      </div>

      <div className="fld" style={{ maxWidth: 520 }}>
        <label>密钥说明（解锁成功后展示，可空）</label>
        <textarea name="note" defaultValue={init?.note ?? ""} rows={2} />
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div className="fld">
          <label>最大使用次数（空=不限）</label>
          <input name="maxUses" type="number" min="1" defaultValue={init?.maxUses ?? ""} style={{ width: 140 }} />
        </div>
        <div className="fld">
          <label>有效截止（空=不过期）</label>
          <input name="validUntil" type="datetime-local" defaultValue={init?.validUntil ?? ""} />
        </div>
        <div className="fld">
          <label>状态</label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, paddingTop: 6 }}>
            <input type="checkbox" name="active" defaultChecked={init ? init.active : true} />
            启用
          </label>
        </div>
      </div>

      <div className="fld">
        <label>可解锁哪些文章</label>
        {posts.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--amuted)" }}>暂无已发布文章。</p>
        )}
        <div style={{ maxHeight: 220, overflow: "auto", border: "1px solid var(--aline)", borderRadius: 6, padding: 8 }}>
          {posts.map((p) => (
            <label key={p.id} style={{ display: "block", fontSize: 13, padding: "3px 0", cursor: "pointer" }}>
              <input
                type="checkbox"
                name="postIds"
                value={p.id}
                checked={postIds.includes(p.id)}
                onChange={() => toggle(p.id)}
                style={{ marginRight: 6 }}
              />
              {p.title}
            </label>
          ))}
        </div>
      </div>

      <button type="submit" className="btn primary sm" style={{ marginTop: 10 }}>
        {editing ? "保存修改" : "创建密钥"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: 写后台页**

Create `src/app/admin/access-keys/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/access-keys";
import { deleteAccessKey, resetUsage } from "./actions";
import AccessKeyForm, { type AccessKeyInit, type PostOption } from "@/components/admin/AccessKeyForm";

export const dynamic = "force-dynamic";

function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default async function AccessKeysPage() {
  const [keys, posts] = await Promise.all([
    prisma.accessKey.findMany({
      orderBy: { createdAt: "desc" },
      include: { posts: { select: { id: true } } },
    }),
    prisma.post.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      select: { id: true, title: true },
    }),
  ]);
  const postOptions: PostOption[] = posts;

  return (
    <div>
      <div className="panel">
        <div className="h">
          <h2>新建访问密钥</h2>
        </div>
        <AccessKeyForm posts={postOptions} />
      </div>

      {keys.map((k) => {
        const init: AccessKeyInit = {
          id: k.id,
          label: k.label ?? "",
          secret: decryptSecret(k.secretEnc),
          note: k.note ?? "",
          maxUses: k.maxUses === null ? "" : String(k.maxUses),
          validUntil: k.validUntil ? toLocalInput(k.validUntil) : "",
          active: k.active,
          postIds: k.posts.map((p) => p.id),
        };
        return (
          <div className="panel" key={k.id}>
            <div className="h" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 style={{ margin: 0 }}>
                {k.label || "（未命名密钥）"} {k.active ? "" : "· 已停用"}
              </h2>
              <span style={{ fontSize: 12, color: "var(--amuted)", marginLeft: "auto" }}>
                已用 {k.usedCount}
                {k.maxUses === null ? "" : ` / ${k.maxUses}`} 次 · 覆盖 {k.posts.length} 篇
                {k.validUntil ? ` · 截止 ${k.validUntil.toLocaleString("zh-CN")}` : ""}
              </span>
              <form action={resetUsage}>
                <input type="hidden" name="id" value={k.id} />
                <button type="submit" className="btn sm">重置次数</button>
              </form>
              <form action={deleteAccessKey}>
                <input type="hidden" name="id" value={k.id} />
                <button type="submit" className="btn sm danger">删除</button>
              </form>
            </div>
            <AccessKeyForm init={init} posts={postOptions} />
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: 构建校验**

Run: `npm run build`
Expected: 构建成功。

- [ ] **Step 4: 提交**

```bash
git add src/components/admin/AccessKeyForm.tsx src/app/admin/access-keys/page.tsx
git commit -m "feat: 访问密钥后台页面与表单"
```

---

### Task 9: 列表页 🔒 角标

**Files:**
- Modify: `src/app/(public)/page.tsx`
- Modify: `src/app/(public)/categories/[slug]/page.tsx`
- Modify: `src/app/(public)/tags/[slug]/page.tsx`

**Interfaces:**
- Consumes: 现有 `include` 查询已返回 `Post.locked` 标量，无需改查询。

> 归档页（ArchiveView）有意不加角标——它是密集时间线名册，加锁标识噪声大；上锁文章仍正常列出，符合「照常列出」。

- [ ] **Step 1: 首页加角标**

Modify `src/app/(public)/page.tsx`，把标题行：

```tsx
              <h2>
                <Link href={`/posts/${p.slug}`}>{p.title}</Link>
              </h2>
```

改为：

```tsx
              <h2>
                <Link href={`/posts/${p.slug}`}>
                  {p.locked && <span title="需要密钥">🔒 </span>}
                  {p.title}
                </Link>
              </h2>
```

- [ ] **Step 2: 分组页加角标**

Modify `src/app/(public)/categories/[slug]/page.tsx`，把：

```tsx
              <h3>
                <Link href={`/posts/${p.slug}`}>{p.title}</Link>
              </h3>
```

改为：

```tsx
              <h3>
                <Link href={`/posts/${p.slug}`}>
                  {p.locked && <span title="需要密钥">🔒 </span>}
                  {p.title}
                </Link>
              </h3>
```

- [ ] **Step 3: 标签页加角标**

Modify `src/app/(public)/tags/[slug]/page.tsx`，把：

```tsx
            <h3>
              <Link href={`/posts/${p.slug}`}>{p.title}</Link>
            </h3>
```

改为：

```tsx
            <h3>
              <Link href={`/posts/${p.slug}`}>
                {p.locked && <span title="需要密钥">🔒 </span>}
                {p.title}
              </Link>
            </h3>
```

- [ ] **Step 4: 构建校验**

Run: `npm run build`
Expected: 构建成功。

- [ ] **Step 5: 提交**

```bash
git add "src/app/(public)/page.tsx" "src/app/(public)/categories/[slug]/page.tsx" "src/app/(public)/tags/[slug]/page.tsx"
git commit -m "feat: 列表页上锁文章 🔒 角标"
```

---

### Task 10: 端到端验证

**Files:** 无（验证任务）

- [ ] **Step 1: 单元测试全绿**

Run: `npm test`
Expected: PASS，access-keys 与 unlock-cookie 全部用例通过。

- [ ] **Step 2: 构建通过**

Run: `npm run build`
Expected: 构建成功，无类型错误。

- [ ] **Step 3: 手动运行时清单（`npm run dev` 后逐项验证）**

以 ADMIN 登录：
- [ ] 编辑某篇已发布文章 → 「访问控制」面板可见 → 勾选上锁、填写说明 → 保存。
- [ ] `/admin/access-keys` → 新建密钥：点「生成」得随机串 → 勾选覆盖该文章 → 设最大次数=2、留空有效期、启用 → 创建。
- [ ] 列表中该密钥显示明文（点「显示」）、已用 0/2、覆盖 1 篇。

读者侧（用未登录的浏览器/隐身窗口）：
- [ ] 打开该上锁文章 → 看到门禁界面（标题+说明+输入框），**查看网页源码/Network 响应里不含正文**。
- [ ] 首页/分组/标签列表里该文章标题前有 🔒，摘要可见。
- [ ] 输错密钥 → 显示「密钥错误或已失效」。
- [ ] 输对密钥 → 跳回文章，正文可读，顶部显示密钥说明横幅；后台该密钥「已用」变为 1/2。
- [ ] 刷新文章 → 仍可读（cookie 生效，不再扣次数，仍为 1/2）。

边界：
- [ ] 用第 2、第 3 个新隐身窗口各输对一次 → 第 2 次成功（2/2），第 3 次因次数用尽显示失败。
- [ ] 后台「重置次数」后，新窗口又可解锁。
- [ ] 把密钥「有效截止」设为过去时间 → 新窗口解锁失败。
- [ ] 以 EDITOR 登录编辑文章 → 看不到「访问控制」面板；构造提交也无法改 locked（持久化层忽略）。
- [ ] EDITOR 直接访问 `/admin/access-keys` → 被中间件重定向回 `/admin`。

- [ ] **Step 4: 收尾提交（如手动验证中有修补）**

```bash
git add -A
git commit -m "chore: 访问许可密钥功能验证收尾"
```

---

## Self-Review

**Spec coverage：**
- 后台给文章设访问密钥 → Task 2/7/8 ✓
- 读者输密钥解锁 → Task 4/5 ✓
- 解锁状态存 cookie、保持 7 天 → Task 3 ✓
- 密钥适用范围（解锁哪些文章 / 最大次数 / 有效截止）→ Task 2/7/8 ✓
- 解锁界面额外说明（文章级）→ Task 6（gateNote）+ Task 5 展示 ✓
- 密钥级说明（解锁后展示）→ Task 7/8（note）+ Task 5 横幅 ✓
- 仅管理员可上锁，编者无权 → Task 6（持久化忽略）+ Task 7（中间件/权限）✓
- 密钥随机生成或自定义 → Task 8（生成按钮 + 自定义输入）✓
- 随时修改密钥及配置 → Task 7/8（updateAccessKey + 预填表单）✓
- 后台可查看明文 → Task 8（decryptSecret + 显示按钮）✓

**Placeholder scan：** 无 TBD/TODO；所有代码步骤均含完整代码。

**Type consistency：** `UnlockState`、`UnlockMap`、`UnlockEntry`、`KeyValidity`、`AccessKeyInit`、`PostOption`、`EditorPost(+locked,gateNote)` 在定义与引用处一致；`unlockPostAction(prev, formData)` 签名与 `useActionState` 用法一致；`active` 复选框 `=== "on"` 与表单 `name="active"` 一致；`secret` 字段名在表单与 actions 一致。
