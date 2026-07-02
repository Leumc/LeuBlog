# 阅读去重 / 预览不计数 / 外链新标签页 / 重置阅读 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修改阅读次数统计逻辑(同 slug 5 小时去重 + 后台预览不计数)、文章正文外链新标签页打开、新增管理员重置文章阅读次数功能。

**Architecture:** A/B/C 三项为前端/渲染层小改,D 项为后台 server action + 编辑页 UI + 自定义确认 modal。无 schema 变更、无新依赖。沿用项目既有模式:客户端 localStorage 去重、rehype 插件改造 HTML、`"use server"` + FormData + `requireAdmin` 权限、项目 CSS 变量。

**Tech Stack:** Next.js App Router、React、Prisma(SQLite)、TypeScript、rehype/remark、vitest。

## Global Constraints

- 测试命令:`npm test`(= `vitest run`)。
- 测试框架:vitest,`describe/it/expect` 从 `vitest` 导入。
- 项目用自建 JWT 会话(`src/lib/auth.ts` + `src/lib/edge-auth.ts`),不是 NextAuth。
- 权限:`requireAdmin()` 在 `src/lib/permissions.ts`,EDITOR 调用抛 `Error("需要管理员权限")`。
- 后台 CSS 全部 scoped 在 `.admin` 下(globals.css 约 1063 行起),变量:`--aline`、`--aink`、`--aaccent`、`--amuted`、`--soft`、`--panel`。`.admin .btn`、`.admin .btn.primary`、`.admin .btn.sm`、`.admin .btn.danger`、`.admin .panel`、`.admin .panel .h`、`.admin .panel .b` 已存在。
- `formatViews(n: number): string` 在 `src/lib/utils.ts:35`,导入路径 `@/lib/utils`。
- 站内链接一律相对路径(`/posts/x`),正文里不会出现绝对本站链接 —— 外链判定**不判 host**,只看 `http://`/`https://` 前缀。
- `renderMarkdown` 是文章页与 `/api/preview` 共用入口。
- 每个任务结束都要 commit。commit message 用中文描述 + Co-Authored-By 尾注。

## File Structure

| 文件 | 动作 | 职责 |
|------|------|------|
| `src/components/reader/ViewTracker.tsx` | 修改 | 去重窗口 5min→5h;检测 `?preview=1` 跳过打点 |
| `src/app/admin/posts/page.tsx` | 修改 | 预览链接加 `?preview=1` |
| `src/lib/markdown.ts` | 修改 | 新增 `rehypeExternalLinks` 插件,插入管线 |
| `src/lib/markdown.test.ts` | 修改 | 新增外链/内链/锚点/mailto 混合断言 |
| `src/app/admin/posts/post-actions.ts` | 修改 | 新增 `resetViews` server action |
| `src/app/admin/posts/[id]/edit/page.tsx` | 修改 | 传 `viewCount`/`canReset` 给 PostEditor |
| `src/components/admin/PostEditor.tsx` | 修改 | 新增「重置阅读」区块 + 接 ConfirmDialog |
| `src/components/admin/ConfirmDialog.tsx` | 新建 | 轻量自定义确认 modal |
| `src/styles/globals.css` | 修改 | 新增 `.admin .modal-backdrop`/`.admin .modal` 样式 |

任务依赖:A、B、C、D1(action)、D4(ConfirmDialog)+D5(css) 互相独立可并行;D2/D3 依赖 D1 与 D4。建议按顺序执行以便每步可独立验证。

---

### Task 1: 阅读去重窗口 5 分钟 → 5 小时 + 预览不计数

A 项与 B 项同触 `ViewTracker.tsx`,合并为一个任务(B 的链接改动在 Task 2)。

**Files:**
- Modify: `src/components/reader/ViewTracker.tsx`(全文)
- Modify: `src/app/admin/posts/page.tsx:76`(预览链接)

**Interfaces:**
- Consumes: 无(纯客户端组件,接收 `slug` prop)
- Produces: 无对外接口;行为变化:同 slug 5h 内不重复打点;URL 含 `preview=1` 时整段跳过。

- [ ] **Step 1: 修改 ViewTracker 去重窗口与 preview 跳过**

把 `src/components/reader/ViewTracker.tsx` 整体替换为:

```tsx
"use client";

import { useEffect } from "react";

/** 同一 slug 上次计数后 5 小时内再次进入不重复计数 */
const DEDUP_WINDOW_MS = 5 * 60 * 60 * 1000;

/** 文章页打点：进入文章计一次；退出后 5 小时内再进不计，超过则再计。
 *  后台预览链接带 ?preview=1，整段跳过（不打点、不写去重时间戳）——
 *  管理员随后正常访问该文仍按正常逻辑计数。 */
export default function ViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("preview") === "1") return; // 后台预览：不计数

    const key = `viewed:${slug}`;
    let last = 0;
    try {
      last = Number(localStorage.getItem(key)) || 0;
    } catch {
      /* 隐私模式等无 localStorage，按未计数处理 */
    }
    const now = Date.now();
    if (now - last < DEDUP_WINDOW_MS) return; // 5 小时内重复进入，不计

    try {
      localStorage.setItem(key, String(now));
    } catch {
      /* 忽略存储失败 */
    }
    fetch("/api/view", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug }),
      keepalive: true,
    }).catch(() => {});
  }, [slug]);
  return null;
}
```

- [ ] **Step 2: 后台预览链接加 `?preview=1`**

在 `src/app/admin/posts/page.tsx` 第 76 行,把:

```tsx
<Link className="lk" href={`/posts/${p.slug}`} target="_blank">
  预览
</Link>
```

改为:

```tsx
<Link className="lk" href={`/posts/${p.slug}?preview=1`} target="_blank">
  预览
</Link>
```

- [ ] **Step 3: 类型检查 + 跑现有测试确保未破坏**

Run: `npm test`
Expected: 全部通过(`views.test.ts`、`markdown.test.ts` 等不受影响;无 ViewTracker 单测)。

Run: `npx tsc --noEmit`
Expected: 无类型错误。

- [ ] **Step 4: 手动验证(本地起服务)**

Run: `npm run dev`(后台运行,在浏览器验证)

验证:
1. 后台 `/admin/posts` 点某篇「预览」→ 新标签打开文章 → 回后台列表刷新,该文「阅读」数**不增**。
2. 正常访问 `/posts/{slug}`(不带 preview)→ 阅读数 +1;5 小时内再进 → 不增;DevTools 清 localStorage 后再进 → 再 +1。

(若无法起服务,至少确认 Step 3 通过即可提交,手动验证留到集成时。)

- [ ] **Step 5: Commit**

```bash
git add src/components/reader/ViewTracker.tsx src/app/admin/posts/page.tsx
git commit -m "feat: 阅读去重窗口拉长到 5 小时 + 后台预览不计数

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: 文章正文外链新标签页(rehype 插件)

C 项。TDD:先写测试,再实现插件。

**Files:**
- Modify: `src/lib/markdown.test.ts`(末尾追加测试)
- Modify: `src/lib/markdown.ts`(新增 `rehypeExternalLinks`,插入 `runPipeline`)

**Interfaces:**
- Consumes: 现有 `HastNode` 类型(`src/lib/markdown.ts:71-77`)、`runPipeline`
- Produces: `renderMarkdown` 产物中 `http://`/`https://` 链接带 `target="_blank" rel="noopener noreferrer"`;其余链接不变。

- [ ] **Step 1: 写失败测试**

在 `src/lib/markdown.test.ts` 末尾追加:

```ts
describe("外链新标签页", () => {
  it("http/https 绝对链接加 target=_blank + rel，其余链接不动", async () => {
    const md = [
      "[外链](https://example.com)",
      "[内链](/posts/inner)",
      "[锚点](#section)",
      "[邮件](mailto:a@b.com)",
    ].join("\n\n");
    const html = await renderMarkdown(md);

    // 外链：带 target 与 rel
    expect(html).toMatch(/<a href="https:\/\/example\.com"[^>]*target="_blank"[^>]*>/);
    expect(html).toMatch(/<a href="https:\/\/example\.com"[^>]*rel="noopener noreferrer"[^>]*>/);

    // 内链：不含 target
    expect(html).toMatch(/<a href="\/posts\/inner">内链<\/a>/);

    // 锚点：不含 target
    expect(html).toMatch(/<a href="#section">锚点<\/a>/);

    // mailto：不含 target
    expect(html).toMatch(/<a href="mailto:a@b\.com">邮件<\/a>/);
  });

  it("相对链接和锚点绝不被加 target", async () => {
    const html = await renderMarkdown("[去](/about) [顶](#top)");
    expect(html).not.toContain("target=");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- markdown.test.ts`
Expected: 新增的两条测试 FAIL(因为当前 `renderMarkdown` 不加 `target`)。其余测试仍 PASS。

- [ ] **Step 3: 实现 `rehypeExternalLinks` 插件**

在 `src/lib/markdown.ts` 的 `rehypeWrapDetailsBody` 函数**之后**(约第 109 行)、`runPipeline` 之前,新增:

```ts
/** 给外链 <a>(http/https 绝对链接)加 target=_blank + rel=noopener noreferrer。
 *  站内一律相对路径，不判 host；相对链接/锚点/mailto/tel 不动。 */
function rehypeExternalLinks() {
  const walk = (node: HastNode) => {
    if (node.type === "element" && node.tagName === "a" && node.properties) {
      const href = node.properties.href;
      if (typeof href === "string" && /^https?:\/\//i.test(href)) {
        node.properties.target = "_blank";
        node.properties.rel = "noopener noreferrer";
      }
    }
    node.children?.forEach(walk);
  };
  return (tree: HastNode) => walk(tree);
}
```

- [ ] **Step 4: 把插件插入 `runPipeline` 管线**

在 `src/lib/markdown.ts` 的 `runPipeline` 函数里,把 `.use(rehypeWrapDetailsBody)` 之后、`.use(rehypeStringify)` 之前,插入 `.use(rehypeExternalLinks)`。改后该段为:

```ts
    .use(rehypeWrapDetailsBody)
    .use(rehypeExternalLinks)
    .use(rehypeStringify)
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npm test -- markdown.test.ts`
Expected: 全部 PASS,包括新增两条。

- [ ] **Step 6: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无错误。

- [ ] **Step 7: Commit**

```bash
git add src/lib/markdown.ts src/lib/markdown.test.ts
git commit -m "feat: 文章正文外链新标签页打开(rehype 插件)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `resetViews` server action

D1 项。

**Files:**
- Modify: `src/app/admin/posts/post-actions.ts`(末尾追加)

**Interfaces:**
- Consumes: `requireAdmin` from `@/lib/permissions`、`prisma` from `@/lib/prisma`、`revalidatePath` from `next/cache`(文件已导入这些,确认即可)
- Produces: `export async function resetViews(formData: FormData): Promise<void>` —— 读取 `formData.get("id")`,事务内 `Post.viewCount=0`(保 `updatedAt`)+ `deleteMany DailyView where postId=id`,然后 revalidate 三个路径。

- [ ] **Step 1: 确认 post-actions.ts 顶部导入**

打开 `src/app/admin/posts/post-actions.ts`,确认顶部已有:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, canEditPost } from "@/lib/permissions";
```

`requireAdmin` 尚未导入。把权限导入行改为:

```ts
import { requireUser, requireAdmin, canEditPost } from "@/lib/permissions";
```

- [ ] **Step 2: 在文件末尾追加 `resetViews`**

在 `src/app/admin/posts/post-actions.ts` 末尾(`deletePost` 函数之后)追加:

```ts
export async function resetViews(formData: FormData): Promise<void> {
  const user = await requireAdmin(); // 仅 ADMIN；EDITOR 调用抛 "需要管理员权限"
  const id = String(formData.get("id") || "");
  const post = await prisma.post.findUnique({
    where: { id },
    select: { updatedAt: true },
  });
  if (!post) return;
  await prisma.$transaction([
    prisma.post.update({
      where: { id },
      data: { viewCount: 0, updatedAt: post.updatedAt }, // 保 updatedAt，避免顶到当前时间
    }),
    prisma.dailyView.deleteMany({ where: { postId: id } }),
  ]);
  revalidatePath("/admin");
  revalidatePath("/admin/posts");
  revalidatePath("/");
}
```

注意:`user` 变量在此仅用于权限校验(`requireAdmin` 内部已校验,未用其返回值也不报错——若 lint 报 `user` 未使用,改为 `await requireAdmin();` 不赋值)。**优先用不赋值写法**:

```ts
export async function resetViews(formData: FormData): Promise<void> {
  await requireAdmin(); // 仅 ADMIN；EDITOR 调用抛 "需要管理员权限"
  const id = String(formData.get("id") || "");
  const post = await prisma.post.findUnique({
    where: { id },
    select: { updatedAt: true },
  });
  if (!post) return;
  await prisma.$transaction([
    prisma.post.update({
      where: { id },
      data: { viewCount: 0, updatedAt: post.updatedAt },
    }),
    prisma.dailyView.deleteMany({ where: { postId: id } }),
  ]);
  revalidatePath("/admin");
  revalidatePath("/admin/posts");
  revalidatePath("/");
}
```

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无错误。

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/posts/post-actions.ts
git commit -m "feat: 新增 resetViews server action（管理员重置文章阅读次数）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: ConfirmDialog 组件 + modal 样式

D4 + D5 项。先建组件再补样式。

**Files:**
- Create: `src/components/admin/ConfirmDialog.tsx`
- Modify: `src/styles/globals.css`(在 admin 样式区末尾追加)

**Interfaces:**
- Consumes: 无(纯 React + 浏览器 DOM)
- Produces: `export function ConfirmDialog(props)`,props:
  - `open: boolean`
  - `title: string`
  - `description: React.ReactNode`
  - `confirmText?: string`(默认 "确认")
  - `cancelText?: string`(默认 "取消")
  - `onConfirm: () => void`
  - `onCancel: () => void`

- [ ] **Step 1: 创建 ConfirmDialog 组件**

创建 `src/components/admin/ConfirmDialog.tsx`:

```tsx
"use client";

import { useEffect, type ReactNode } from "react";

/** 轻量确认 modal：Esc / 点 backdrop / 取消按钮 关闭；确认按钮回调 onConfirm。
 *  样式用 .admin .modal-backdrop / .admin .modal（见 globals.css）。 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "确认",
  cancelText = "取消",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h3>{title}</h3>
        <div className="modal-body">{description}</div>
        <div className="modal-actions">
          <button type="button" className="btn sm" onClick={onCancel}>
            {cancelText}
          </button>
          <button type="button" className="btn primary sm" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 追加 modal 样式**

在 `src/styles/globals.css` 的 admin 样式区末尾(最后一个 `.admin ...` 规则之后)追加:

```css
.admin .modal-backdrop { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.admin .modal { background: var(--panel); border: 1px solid var(--aline); border-radius: 8px; padding: 20px 22px; max-width: 420px; width: calc(100% - 32px); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25); }
.admin .modal h3 { margin: 0 0 10px; font-size: 15px; font-weight: 700; color: var(--aink); }
.admin .modal-body { font-size: 13px; color: var(--soft); margin-bottom: 16px; line-height: 1.6; }
.admin .modal-actions { display: flex; justify-content: flex-end; gap: 8px; }
```

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无错误(`ReactNode` 已从 `react` 导入)。

- [ ] **Step 4: 跑测试确保 globals.test.ts 未破坏**

Run: `npm test -- globals.test.ts`
Expected: PASS(只加 CSS 规则,不改既有)。

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/ConfirmDialog.tsx src/styles/globals.css
git commit -m "feat: 新增 ConfirmDialog 组件 + modal 样式

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: 编辑页传参与 PostEditor 重置区块

D2 + D3 项。把 `viewCount`/`canReset` 透传到 PostEditor,在主 form 之外加独立重置 form + ConfirmDialog。

**Files:**
- Modify: `src/app/admin/posts/[id]/edit/page.tsx`(给 PostEditor 传新 props)
- Modify: `src/components/admin/PostEditor.tsx`(类型 + props + 重置区块)

**Interfaces:**
- Consumes: `resetViews` from `@/app/admin/posts/post-actions`(Task 3)、`ConfirmDialog` from `@/components/admin/ConfirmDialog`(Task 4)、`formatViews` from `@/lib/utils`
- Produces: PostEditor 接收 `viewCount?: number`、`canReset: boolean`;ADMIN 编辑已有文章时页面底部出现「重置阅读次数」区块。

- [ ] **Step 1: 编辑页传 `viewCount` 与 `canReset`**

在 `src/app/admin/posts/[id]/edit/page.tsx` 的 `<PostEditor ... />` 调用里,在 `canLock={user.role === "ADMIN"}` 之后追加两个 props:

```tsx
      canLock={user.role === "ADMIN"}
      canReset={user.role === "ADMIN"}
      viewCount={post.viewCount}
```

(该文件 `prisma.post.findUnique` 未加 select,默认返回全字段,`post.viewCount` 可直接用。)

- [ ] **Step 2: PostEditor 类型加 `viewCount`、props 加 `canReset`**

在 `src/components/admin/PostEditor.tsx`:

2a. `EditorPost` 类型(约第 14-26 行)在末尾 `keyIds: string[];` 之后加一行:

```ts
  keyIds: string[];
  viewCount?: number;
```

2b. 组件参数解构(约第 34-53 行)把 `canLock,` 之后加 `canReset,`:

```tsx
export default function PostEditor({
  post,
  categories,
  taxonomy,
  canLock,
  canReset,
  allKeys,
}: {
  post: EditorPost;
  categories: { id: string; name: string }[];
  taxonomy: Taxonomy;
  canLock: boolean;
  canReset: boolean;
  allKeys: { ... }[];
}) {
```

- [ ] **Step 3: 引入 resetViews、ConfirmDialog、formatViews、useRef/useState**

在 `src/components/admin/PostEditor.tsx` 顶部导入区,把:

```tsx
import { savePostAsDraft, publishPost } from "@/app/admin/posts/post-actions";
```

改为:

```tsx
import { savePostAsDraft, publishPost, resetViews } from "@/app/admin/posts/post-actions";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { formatViews } from "@/lib/utils";
```

(确认 `useRef` 已在 `import { useCallback, useEffect, useRef, useState } from "react";` 中——已存在。)

- [ ] **Step 4: 加重置 form 的 state 与 ref**

在组件函数体顶部已有 state 区(约第 54-65 行,`const [gateNote, setGateNote] = ...` 附近)追加:

```tsx
  const [resetOpen, setResetOpen] = useState(false);
  const resetFormRef = useRef<HTMLFormElement>(null);
```

- [ ] **Step 5: 在主 `</form>` 之外追加重置区块**

在 `src/components/admin/PostEditor.tsx`,主 `<form>` 的闭合 `</form>`(约第 419 行,文件末尾 `{canLock && (...)}</form>` 中的 `</form>`)之后、组件最外层 `return (` 的闭合 `</...>` 之前,插入重置区块。

最稳妥:把当前 `return ( <form ...> ... </form> );` 改为 `return ( <> <form ...> ... </form> {重置区块} </> );`。

具体:找到 `return (\n    <form action={savePostAsDraft}>`,在最外层包一层 `<>`;找到末尾对应的 `</form>\n  );` 改为 `</form>\n\n      {canReset && post.id && (\n        <div className="panel" style={{ marginTop: 16 }}>\n          ... \n        </div>\n      )}\n    </>\n  );`。

完整重置区块代码(插在 `</form>` 之后、`</>` 之前):

```tsx
        {canReset && post.id && (
          <form action={resetViews} ref={resetFormRef} style={{ marginTop: 16 }}>
            <input type="hidden" name="id" value={post.id} />
            <div className="panel">
              <div className="h">
                <h2>阅读统计</h2>
              </div>
              <div
                className="b"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontSize: 14, color: "var(--soft)" }}>
                  当前阅读 <b style={{ color: "var(--aink)" }}>{formatViews(post.viewCount ?? 0)}</b> 次
                </span>
                <span className="sp" style={{ marginLeft: "auto" }} />
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => setResetOpen(true)}
                >
                  重置阅读次数
                </button>
              </div>
            </div>
            <ConfirmDialog
              open={resetOpen}
              title="重置阅读次数"
              description={
                <>
                  当前阅读 <b>{formatViews(post.viewCount ?? 0)}</b> 次，重置后该数据归零且无法恢复。
                </>
              }
              confirmText="重置"
              onCancel={() => setResetOpen(false)}
              onConfirm={() => {
                setResetOpen(false);
                resetFormRef.current?.requestSubmit();
              }}
            />
          </form>
        )}
```

- [ ] **Step 6: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无错误。常见问题:`<>` 片段包裹后 JSX 闭合要配对;`requestSubmit` 在 `HTMLFormElement` 上存在(现代 TS lib.dom)。

- [ ] **Step 7: 跑测试**

Run: `npm test`
Expected: 全部 PASS(无 PostEditor 单测,确保未破坏其他)。

- [ ] **Step 8: 手动验证(本地起服务)**

Run: `npm run dev`

1. 以 ADMIN 登录 → `/admin/posts` → 点某篇「编辑」→ 编辑页底部出现「阅读统计」面板,显示「当前阅读 N 次」+「重置阅读次数」按钮。
2. 点按钮 → modal 弹出,显示 N 与警告 → 点「取消」/按 Esc / 点遮罩 → 关闭,阅读数不变。
3. 再点按钮 → modal → 点「重置」→ 提交 → 页面刷新,「当前阅读 0 次」;回 `/admin` 仪表盘,该文热门排行与总阅读量已相应更新;`/admin/posts` 列表阅读数显示 0。
4. 以 EDITOR 登录(若有账号)→ 编辑本人文章 → **底部无**「阅读统计」面板。

(若无法起服务,确认 Step 6/7 通过即可提交。)

- [ ] **Step 9: Commit**

```bash
git add src/app/admin/posts/[id]/edit/page.tsx src/components/admin/PostEditor.tsx
git commit -m "feat: 文章编辑页新增管理员重置阅读次数(自定义 modal 确认)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: 全量验证 + 收尾

**Files:** 无(仅验证)

- [ ] **Step 1: 全量测试**

Run: `npm test`
Expected: 全部 PASS。

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无错误。

- [ ] **Step 3: 构建检查(可选但推荐)**

Run: `npm run build`
Expected: 构建成功(无 server/client 边界错误;`ConfirmDialog` 是 `"use client"`,`PostEditor` 已是 client,`resetViews` 是 server action)。

- [ ] **Step 4: 完整手动验证清单**

Run: `npm run dev`,逐条核对:

1. 后台 `/admin/posts` 点「预览」→ 新标签打开文章 → 阅读数不增。
2. 同一文章 5 小时内重复正常进入 → 只增一次;清 localStorage 再进 → 再增。
3. 文章正文里 `http://`/`https://` 链接 → 新标签打开;站内相对链接、`#锚点`、`mailto:` → 当前页/默认。
4. ADMIN 编辑页「重置阅读次数」→ modal 确认 → 阅读数归零,仪表盘/列表同步。
5. EDITOR 编辑页无重置区块;EDITOR 伪造提交 `resetViews` → 报「需要管理员权限」(可用 curl 带 EDITOR cookie 验证,或信任 `requireAdmin` 单测级保障)。

- [ ] **Step 5: 更新记忆(若需)**

本任务未改认证/schema/构建方式,无需更新 memory。`auth-deviation.md` 仍准确。

- [ ] **Step 6: 最终 commit(若有残留改动)**

```bash
git status
# 若干净则无需提交;若有 docs/验证产物残留，按需提交
```
