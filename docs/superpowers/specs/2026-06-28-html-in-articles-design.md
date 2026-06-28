# 文章支持 HTML 标签（折叠框等复古组件）

日期：2026-06-28

## 背景与目标

文章正文目前走 Markdown 管线（remark → rehype），原始 HTML 被默认丢弃。目标是让作者能在文章里直接写 HTML 标签实现额外排版功能，重点是**折叠框**，并提供一组符合站点「复古/纸感」设计语言的预置组件样式。后台编辑器的实时预览也要正确渲染这些 HTML。

设计语言沿用现有系统：暖纸底 `--paper`/`--paper-2`、墨色 `--ink`/`--ink-soft`、红强调 `--accent (#9c2b22)`、`--rule` 边线、衬线/等宽字体——与代码块、引用块一致。

## 安全模型

**完全放开，不做 sanitize。** 文章仅由站长 / 受信编辑（已认证）撰写，作者可信，XSS 风险由作者自负。换取最简单、最灵活的实现（任意 HTML，含 `<details>`、`<div>`、`<span>`、`<style>` 等）。

## 范围

四个能力 + 一处管线改动：

1. 渲染管线支持原始 HTML
2. 四个预置组件样式：折叠框、提示框、徽章、分栏
3. 编辑器工具栏新增「折叠框」「提示框」快捷插入按钮
4. 阅读动效与新组件的兼容性确认

## 详细设计

### 1. 渲染管线（`src/lib/markdown.ts`）

文章页（`(reading)/posts/[slug]`）与后台预览（`/api/preview`）共用 `renderMarkdown()`，改一处两边同时生效。

改动：

- `remarkRehype` 传 `{ allowDangerousHtml: true }`，让原始 HTML 以 `raw` 节点穿过
- 紧接其后 `.use(rehypeRaw)`，把 `raw` 节点重新解析为真实 hast 节点
- `rehypeRaw` 必须位于 `remarkRehype` 之后、`rehypeSlug` 之前——这样 HTML 内的 `<h2>` 等标题也能拿到锚点 id、进入目录
- `rehypeKatex` / `rehypePrettyCode` / `rehypeStringify` 顺序不变，照常工作

管线顺序：

```
remarkParse → remarkGfm → remarkMath
→ remarkRehype({ allowDangerousHtml: true })
→ rehypeRaw
→ rehypeSlug → rehypeKatex → rehypePrettyCode → rehypeStringify
```

新增依赖：`rehype-raw`。

注意：`extractToc()` 仍只解析 Markdown 标题（remark 阶段），HTML 里的 `<h2>` 不进目录树——本次不改 TOC 提取逻辑（YAGNI），仅保证锚点 id 不冲突即可。

### 2. 预置组件样式（`src/styles/globals.css`）

全部挂在 `.body` 选择器下。后台预览容器为 `.ed-pv .body`、文章页为 `ArticleBody` 的 `.body`，因此前台与预览自动一致。

- **折叠框** `<details><summary>…</summary>…</details>`
  - 纸感边框 `1px solid var(--rule)`，圆角 ~5px
  - `<summary>` 用 `--paper-2` 底、`--accent` 左色条、`▸` 三角（`details[open]` 时旋转 90°）
  - 隐藏浏览器默认 marker，自定义指示符
- **提示框** `<div class="callout">`（变体 `info` / `warn` / `tip`）
  - 左侧 3px 色条 + 前置图标，沿用 blockquote 的 `--paper-2` 纸底质感
  - 语义色：`info` = `--accent`，`warn` = `--gold`，`tip` = `--accent-2`
  - 无变体类时按 `info` 默认呈现
- **徽章** `<span class="badge">`
  - 行内小标签，`--rule` 描边 + `--paper-2` 底，等宽小字号 letterpress 风
- **分栏** `<div class="cols">`
  - CSS grid 两栏 `grid-template-columns: 1fr 1fr` + gap
  - 窄屏 `@media (max-width: 720px)`（与现有断点一致）堆叠为单栏

### 3. 编辑器工具栏（`src/components/admin/PostEditor.tsx`）

在现有 `.ed-tools` 工具栏（加粗/斜体/标题…那一排）的合适位置，新增两个按钮，复用已有 `insert(text)` 机制插入 HTML 片段模板：

- 「折叠框」插入：
  ```
  \n<details>\n<summary>标题</summary>\n\n内容\n\n</details>\n
  ```
- 「提示框」插入：
  ```
  \n<div class="callout info">\n\n提示内容\n\n</div>\n
  ```

注意片段内留空行，确保 `<details>`/`<div>` 内部的 Markdown 仍被解析（remark 对块级 HTML 内的内容，需空行分隔才当 Markdown 处理）。

预览无需改动：管线打通后 `/api/preview` 自动渲染 HTML。

### 4. 阅读动效兼容（`src/components/reader/ArticleBody.tsx`）

无需改动，仅需确认：

- `ArticleBody` 把 `.body` 的顶层子节点逐块做入场动画
- 顶层 `<details>` / `<div class="callout">` / `<div class="cols">` 不在打字机的 `TEXT_TAGS`（P/H1-4/UL/OL/BLOCKQUOTE）集合内，因此走「浮入淡入」(reveal) 路径，作为整块淡入
- 与现有动效天然兼容，无冲突

## 不做（YAGNI）

- 不做 HTML sanitize / 白名单
- 不把 HTML 标题纳入 TOC 目录
- 不做分栏以外的更复杂版式（tabs、手风琴组等）
- 不为 `<details>` 内部做独立的逐块动画

## 测试 / 验证

- `renderMarkdown()` 单测：输入含 `<details>`、`<div class="callout">` 的 Markdown，断言输出保留对应标签（管线不再丢弃 HTML）
- 手动验证：后台编辑器实时预览中四个组件按纸感样式正确显示；文章前台页面一致；折叠框可展开/收起；窄屏分栏堆叠

## 涉及文件

- `src/lib/markdown.ts` —— 管线加 `allowDangerousHtml` + `rehypeRaw`
- `src/styles/globals.css` —— 四个组件样式
- `src/components/admin/PostEditor.tsx` —— 工具栏两个插入按钮
- `package.json` —— 新增 `rehype-raw`
- `src/lib/markdown.test.ts`（新建）—— 管线 HTML 回归测试
