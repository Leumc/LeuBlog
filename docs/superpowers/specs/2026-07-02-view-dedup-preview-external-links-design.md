# 阅读去重 / 预览不计数 / 外链新标签页 — 设计

日期:2026-07-02
状态:待实现

## 目标

三处独立改动,互不耦合:

1. **阅读去重窗口拉长**:同一篇文章(同 slug)5 分钟内重复进入不计数 → 改为 **5 小时**内不重复计数。
2. **后台预览不计数**:后台文章列表点「预览」进入文章页那次访问,不记录阅读次数。
3. **正文外链新标签页**:文章正文里的外链,点击后浏览器在新标签页打开,而非当前页跳转。

## 现状(已核实)

- **阅读计数**:`src/components/reader/ViewTracker.tsx`(客户端)用 `localStorage`,key 为 `viewed:${slug}`,**5 分钟**去重窗口;命中窗口则跳过,否则写时间戳并 `fetch('/api/view', { body: { slug } })`。后端 `src/app/api/view/route.ts` 校验 slug 为 PUBLISHED 后调用 `src/lib/views.ts` 的 `recordView`,在事务内 `Post.viewCount++` 且按天聚合 `DailyView`(文章维度 + 全站维度)。后端无去重,完全信任前端窗口。
- **后台预览**:`src/app/admin/posts/page.tsx:76` 渲染「预览」链接 `href={/posts/${p.slug}}` 且 `target="_blank"`,跳转到公开文章页,该页挂载 `ViewTracker` → **当前会被计数**。
- **正文链接**:文章正文由 `src/lib/markdown.ts` 的 `renderMarkdown` 服务端渲染成 HTML(`remarkRehype` → `rehypeRaw` → `rehypeSlug` → `rehypeKatex` → `rehypePrettyCode` → `rehypeWrapDetailsBody` → `rehypeStringify`),产物为纯 `<a>` 标签,无 `target`,点击在当前页跳转。`renderMarkdown` 同时被文章页和 `/api/preview` 后台预览接口共用。
- 站内链接一律使用相对路径(`/posts/x`、`/categories/x`、`/tags/x`),正文里不会出现绝对形式的本站链接。

## 决策(已与用户确认)

| 决策点 | 选择 |
|--------|------|
| 去重实现位置 | 客户端 localStorage 窗口拉长到 5 小时(不改后端、不入库) |
| 预览不计数识别 | 预览链接加 `?preview=1`,ViewTracker 检测到该参数即跳过打点 |
| 新标签页范围 | 仅文章正文外链;站内导航(分类/标签/上下篇)保持同页 |
| 外链判定 | **不判 host**:凡是 `http://` 或 `https://` 开头的绝对链接一律视为外链,加 `target="_blank"`。相对路径/锚点/`mailto:`/`tel:` 不动 |

## 设计

### A. 去重窗口 5 分钟 → 5 小时

**文件**:`src/components/reader/ViewTracker.tsx`

- 常量 `DEDUP_WINDOW_MS`:`5 * 60 * 1000` → `5 * 60 * 60 * 1000`(5 小时)。
- 顶部注释同步更新(5 分钟 → 5 小时)。
- 其余逻辑不变:命中窗口 `return`;否则写时间戳并打点。
- 后端 `recordView`、`DailyView` 聚合、`/api/view` 全部不动。

### B. 后台预览不计数(`?preview=1`)

**文件1**:`src/app/admin/posts/page.tsx`(第 76 行预览链接)
- `href={`/posts/${p.slug}`}` → `href={`/posts/${p.slug}?preview=1`}`,`target="_blank"` 保留。

**文件2**:`src/components/reader/ViewTracker.tsx`
- useEffect 体内、读取 localStorage **之前**,解析查询参数:
  ```ts
  const params = new URLSearchParams(window.location.search);
  if (params.get("preview") === "1") return; // 后台预览:不计数、不写去重时间戳
  ```
- 早返回保证:预览那次既不打点,也不占用 5 小时去重窗口 —— 管理员随后正常访问该文章仍按正常逻辑计数。

### C. 正文外链新标签页(rehype 插件)

**文件**:`src/lib/markdown.ts`

新增 rehype 插件函数 `rehypeExternalLinks`,插入 `runPipeline` 管线(与 `rehypeWrapDetailsBody` 同层,位于 `rehypeStringify` 之前):

```ts
/** 给外链 <a>(http/https 绝对链接)加 target=_blank + rel=noopener noreferrer。
 *  站内一律相对路径,不判 host;相对链接/锚点/mailto/tel 不动。 */
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

- 判定:仅看 `href` 是否以 `http://` 或 `https://`(忽略大小写)开头。是 → 外链,加属性;否 → 不动。
- 不解析 `new URL`,无异常面;`href` 非字符串时跳过。
- 复用现有 `HastNode` 类型。
- 因 `renderMarkdown` 是文章页与 `/api/preview` 共用入口,后台编辑器实时预览里的外链也会自动获得新标签页行为(一致,符合预期)。

## 数据流(不变)

```
文章页 (reading)/posts/[slug]/page.tsx
  └─ <ViewTracker slug>  ──(5h 窗口 & 非 preview)──►  POST /api/view {slug}
                                                            └─ recordView → Post.viewCount++ / DailyView++
  └─ renderMarkdown(post.content) ──► HTML(外链已带 target=_blank) ──► <ArticleBody>

后台预览 admin/posts/page.tsx
  └─ 预览链接 /posts/{slug}?preview=1 (target=_blank) ──► 文章页 ──► ViewTracker 检测 preview=1 ──► 不打点
```

## 错误处理与边界

- **隐私模式 / 无 localStorage**:已有 try/catch,行为不变(按未计数处理,每次进入都计数)。本次不改。
- **`?preview=1` 被分享**:带该参数的链接被分享后,访客打开也不计数。影响极小,且与「预览不计数」语义一致。可接受。
- **外链判定**:
  - 相对链接(`/posts/x`)、锚点(`#toc`)、`mailto:`/`tel:` → 不动,保持当前页/默认行为。
  - `http://`/`https://` 绝对链接 → 一律新标签页。站内不会出现绝对本站链接(全用相对路径),无误伤。
  - 畸形 href:`typeof href === "string"` 守卫 + 正则,无 `new URL` 调用,不会抛错。

## 测试

- **`src/lib/views.test.ts`**:不涉及窗口长度与 preview 参数,无需改动,继续通过。
- **`src/lib/markdown.test.ts`**:**新增一条测试**。输入含外链 + 站内相对链接 + 锚点 + `mailto:` 的混合 markdown,断言:
  - 外链 `<a>` 含 `target="_blank"` 与 `rel="noopener noreferrer"`。
  - 相对链接、锚点、`mailto:` 的 `<a>` **不含** `target`。
- **`ViewTracker.tsx`**:暂不补单测(依赖 localStorage/fetch/window.location,纯客户端 useEffect,mock 成本高、收益低)。靠手动验证。
- **手动验证清单**(实现后执行):
  1. 后台文章列表点「预览」→ 新标签打开文章 → 回后台列表刷新,「阅读」数不增。
  2. 同一文章 5 小时内重复进入 → 阅读数只增一次;清 localStorage 后再进 → 再增一次。
  3. 文章正文外链点击 → 新标签打开;站内链接、锚点 → 当前页/默认行为。

## 不在范围内(YAGNI)

- 不引入服务端 IP 去重表 / 不改 `/api/view` 服务端逻辑。
- 不改 `DailyView` schema。
- 不改 `recordView`。
- 不对全站导航/侧栏/页脚链接做新标签页处理。
- 不给 `ViewTracker` 加客户端单测。
