# 文章支持 HTML 标签（折叠框等组件）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让文章正文支持原始 HTML（重点折叠框），并提供四个纸感预置组件样式，后台编辑器实时预览同步渲染。

**Architecture:** 在共用的 `renderMarkdown()` 管线里开启 `allowDangerousHtml` 并接入 `rehype-raw`，一改即同时作用于文章页与 `/api/preview` 预览。组件样式全部挂在 `.body` 选择器下，前台与预览容器（`.ed-pv .body`）自动一致。编辑器工具栏加两个 HTML 片段插入按钮。

**Tech Stack:** Next.js 15 / React 19、unified 11（remark + rehype）、rehype-raw、Vitest、纯 CSS（`src/styles/globals.css`）。

## Global Constraints

- 不做 HTML sanitize / 白名单——完全放开（作者可信）。
- 组件样式必须沿用现有设计 token：`--paper`/`--paper-2`、`--ink`/`--ink-soft`、`--accent (#9c2b22)`、`--accent-2`、`--gold`、`--rule`、`--serif`/`--mono`。
- 样式一律挂在 `.body` 下，使前台 `ArticleBody` 与后台预览 `.ed-pv .body` 共享。
- 窄屏断点与现有一致：`@media (max-width: 720px)`。
- `rehype-raw` 必须位于 `remarkRehype` 之后、`rehypeSlug` 之前。
- 测试文件命名 `*.test.ts`，放在 `src/lib/` 下（vitest `include: src/**/*.test.ts`）。

---

### Task 1: 渲染管线支持原始 HTML

**Files:**
- Modify: `package.json`（新增依赖 `rehype-raw`）
- Modify: `src/lib/markdown.ts`（`renderMarkdown` 管线）
- Test: `src/lib/markdown.test.ts`（新建）

**Interfaces:**
- Consumes: 无（管线起点）
- Produces: `renderMarkdown(md: string): Promise<string>` 行为变更——输出保留原始 HTML 标签（如 `<details>`、`<div class="callout">`），不再被丢弃。签名不变。

- [ ] **Step 1: 安装依赖**

Run:
```bash
npm install rehype-raw
```
Expected: `package.json` 的 dependencies 多出 `"rehype-raw"`，安装成功无错误。

- [ ] **Step 2: 写失败测试**

新建 `src/lib/markdown.test.ts`：
```ts
import { describe, it, expect } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown HTML 支持", () => {
  it("保留 details/summary 折叠框标签", async () => {
    const html = await renderMarkdown(
      "<details>\n<summary>标题</summary>\n\n正文\n\n</details>",
    );
    expect(html).toContain("<details>");
    expect(html).toContain("<summary>标题</summary>");
  });

  it("保留 div.callout 提示框，且内部 Markdown 被解析", async () => {
    const html = await renderMarkdown(
      '<div class="callout info">\n\n**重点**内容\n\n</div>',
    );
    expect(html).toContain('class="callout info"');
    expect(html).toContain("<strong>重点</strong>");
  });

  it("普通 Markdown 仍正常渲染", async () => {
    const html = await renderMarkdown("# 标题\n\n段落");
    expect(html).toContain("<h1");
    expect(html).toContain("段落");
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npx vitest run src/lib/markdown.test.ts`
Expected: FAIL —— 前两个用例失败，输出不含 `<details>` / `class="callout info"`（当前管线丢弃 HTML）。

- [ ] **Step 4: 改管线接入 rehype-raw**

在 `src/lib/markdown.ts` 顶部 import 区加：
```ts
import rehypeRaw from "rehype-raw";
```

把 `renderMarkdown` 里的管线从：
```ts
    .use(remarkRehype)
    .use(rehypeSlug)
```
改为：
```ts
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSlug)
```
其余 `.use(...)` 顺序保持不变。

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run src/lib/markdown.test.ts`
Expected: PASS（3 个用例全过）。

- [ ] **Step 6: 类型/构建检查**

Run: `npx tsc --noEmit`
Expected: 无报错（若 `rehype-raw` 无类型，确认其自带 d.ts；当前版本自带，无需额外 @types）。

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/lib/markdown.ts src/lib/markdown.test.ts
git commit -m "feat: 文章渲染管线支持原始 HTML（rehype-raw）"
```

---

### Task 2: 四个预置组件的纸感样式

**Files:**
- Modify: `src/styles/globals.css`（在 `.body hr` 那段之后、`.katex-display` 之前的区域新增一个组件样式区块）

**Interfaces:**
- Consumes: Task 1 的管线（HTML 标签现在能进入 `.body`）
- Produces: CSS 类约定——`.body details`/`summary`、`.body .callout`(+ `.info`/`.warn`/`.tip`)、`.body .badge`、`.body .cols`。Task 3 的插入模板依赖这些类名。

- [ ] **Step 1: 新增组件样式区块**

在 `src/styles/globals.css` 中，紧接 `.body hr { ... }` 这一行之后插入：
```css
/* ============================================================
   文章内 HTML 预置组件（纸感风格）——前台与后台预览共用 .body
   ============================================================ */

/* 折叠框 */
.body details {
  margin: 22px 0;
  border: 1px solid var(--rule);
  border-left: 3px solid var(--accent);
  border-radius: 5px;
  background: var(--paper);
  overflow: hidden;
}
.body details > summary {
  list-style: none;
  cursor: pointer;
  padding: 11px 16px;
  background: var(--paper-2);
  font-family: var(--sans);
  font-weight: 600;
  font-size: 15px;
  color: var(--ink-soft);
  display: flex;
  align-items: center;
  gap: 9px;
  user-select: none;
}
.body details > summary::-webkit-details-marker { display: none; }
.body details > summary::before {
  content: "\25B8"; /* ▸ */
  color: var(--accent);
  font-size: 12px;
  transition: transform 0.18s ease;
}
.body details[open] > summary::before { transform: rotate(90deg); }
.body details > summary:hover { color: var(--accent); }
.body details > *:not(summary) { padding: 0 16px; }
.body details > summary + * { margin-top: 14px; }
.body details > *:last-child { margin-bottom: 14px; }

/* 提示框 */
.body .callout {
  margin: 22px 0;
  padding: 12px 16px 12px 44px;
  position: relative;
  background: var(--paper-2);
  border: 1px solid var(--rule);
  border-left: 3px solid var(--accent);
  border-radius: 4px;
  color: var(--ink-soft);
}
.body .callout::before {
  content: "\2139"; /* ℹ 默认 info */
  position: absolute;
  left: 15px;
  top: 12px;
  font-size: 16px;
  color: var(--accent);
  font-style: normal;
}
.body .callout > :first-child { margin-top: 0; }
.body .callout > :last-child { margin-bottom: 0; }
.body .callout.info { border-left-color: var(--accent); }
.body .callout.info::before { content: "\2139"; color: var(--accent); }
.body .callout.warn { border-left-color: var(--gold); }
.body .callout.warn::before { content: "\26A0"; color: var(--gold); } /* ⚠ */
.body .callout.tip { border-left-color: var(--accent-2); }
.body .callout.tip::before { content: "\2726"; color: var(--accent-2); } /* ✦ */

/* 徽章 */
.body .badge {
  display: inline-block;
  font-family: var(--mono);
  font-size: 0.72em;
  line-height: 1.4;
  letter-spacing: 0.04em;
  padding: 1px 8px;
  margin: 0 2px;
  border: 1px solid var(--rule);
  border-radius: 3px;
  background: var(--paper-2);
  color: var(--ink-soft);
  vertical-align: middle;
}

/* 分栏 */
.body .cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 22px;
  margin: 22px 0;
}
.body .cols > * { margin: 0; }
@media (max-width: 720px) {
  .body .cols { grid-template-columns: 1fr; gap: 0; }
}
```

- [ ] **Step 2: 启动 dev 服务器手动验证**

Run: `npm run dev`
打开任一文章编辑页（`/admin/posts/new`），在 Markdown 源里粘贴：
```
<details>
<summary>点我展开</summary>

折叠内容里也能写 **Markdown**。

</details>

<div class="callout warn">

⚠ 这是一条警告提示。

</div>

普通文本 <span class="badge">NEW</span> 行内徽章。

<div class="cols">
<div>左栏内容</div>
<div>右栏内容</div>
</div>
```
Expected：右侧实时预览中——折叠框可展开/收起且三角旋转；callout 显示黄色警告条+⚠；badge 行内小标签；分栏左右并排。窄屏（缩窄窗口）分栏堆叠为单栏。

- [ ] **Step 3: Commit**

```bash
git add src/styles/globals.css
git commit -m "feat: 文章 HTML 组件纸感样式（折叠框/提示框/徽章/分栏）"
```

---

### Task 3: 编辑器工具栏插入按钮

**Files:**
- Modify: `src/components/admin/PostEditor.tsx`（`.ed-tools` 工具栏，约 185–214 行区域）

**Interfaces:**
- Consumes: 已有的 `insert(text: string, wrap?: string)` 回调（`PostEditor.tsx:82`）；Task 2 定义的类名 `details`/`callout info`。
- Produces: 无下游依赖（终点任务）。

- [ ] **Step 1: 在工具栏插入两个按钮**

在 `src/components/admin/PostEditor.tsx` 的 `.ed-tools` 内，紧接「列表」按钮（`onClick={() => insert("\n- 项目\n")}` 那个 `<button>`）之后、其后的 `<span className="gap" />` 之前，插入：
```tsx
          <span className="gap" />
          <button
            type="button"
            title="折叠框"
            onClick={() =>
              insert(
                "\n<details>\n<summary>标题</summary>\n\n内容\n\n</details>\n",
              )
            }
          >
            ▸
          </button>
          <button
            type="button"
            title="提示框"
            onClick={() =>
              insert('\n<div class="callout info">\n\n提示内容\n\n</div>\n')
            }
          >
            ⚑
          </button>
```

- [ ] **Step 2: 手动验证按钮**

dev 服务器下打开文章编辑页，点工具栏「折叠框」「提示框」按钮。
Expected：光标处分别插入对应 HTML 片段模板；右侧预览随即渲染出折叠框 / 提示框。

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无报错。

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/PostEditor.tsx
git commit -m "feat: 编辑器工具栏增加折叠框/提示框插入按钮"
```

---

### Task 4: 全量回归与收尾验证

**Files:**
- 无代码改动（验证任务）

**Interfaces:**
- Consumes: Task 1–3 全部成果
- Produces: 无

- [ ] **Step 1: 跑全量测试**

Run: `npm test`
Expected: 全部通过，含新增 `markdown.test.ts`。

- [ ] **Step 2: 前台文章页验证**

dev 下发布一篇含四个组件的文章，访问 `/posts/<slug>`。
Expected：四个组件在前台样式与预览一致；折叠框可交互；阅读动效（浮入）下组件整块淡入正常，无报错。

- [ ] **Step 3: 构建检查**

Run: `npm run build`
Expected: 构建成功，无类型/编译错误。
