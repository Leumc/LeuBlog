# 阅读去重 / 预览不计数 / 外链新标签页 / 重置阅读 — 设计

日期:2026-07-02
状态:待实现

## 目标

四处独立改动,前三项互不耦合,第四项(重置)与第二项共用「后台文章」场景但独立实现:

1. **阅读去重窗口拉长**:同一篇文章(同 slug)5 分钟内重复进入不计数 → 改为 **5 小时**内不重复计数。
2. **后台预览不计数**:后台文章列表点「预览」进入文章页那次访问,不记录阅读次数。
3. **正文外链新标签页**:文章正文里的外链,点击后浏览器在新标签页打开,而非当前页跳转。
4. **重置文章阅读次数(仅管理员)**:在文章编辑页提供「重置阅读次数」操作,把该文 `Post.viewCount` 归零并删除其所有 `DailyView` 按天聚合行;点击后弹出自定义 modal 二次确认。

## 现状(已核实)

- **阅读计数**:`src/components/reader/ViewTracker.tsx`(客户端)用 `localStorage`,key 为 `viewed:${slug}`,**5 分钟**去重窗口;命中窗口则跳过,否则写时间戳并 `fetch('/api/view', { body: { slug } })`。后端 `src/app/api/view/route.ts` 校验 slug 为 PUBLISHED 后调用 `src/lib/views.ts` 的 `recordView`,在事务内 `Post.viewCount++` 且按天聚合 `DailyView`(文章维度 + 全站维度)。后端无去重,完全信任前端窗口。
- **后台预览**:`src/app/admin/posts/page.tsx:76` 渲染「预览」链接 `href={/posts/${p.slug}}` 且 `target="_blank"`,跳转到公开文章页,该页挂载 `ViewTracker` → **当前会被计数**。
- **正文链接**:文章正文由 `src/lib/markdown.ts` 的 `renderMarkdown` 服务端渲染成 HTML(`remarkRehype` → `rehypeRaw` → `rehypeSlug` → `rehypeKatex` → `rehypePrettyCode` → `rehypeWrapDetailsBody` → `rehypeStringify`),产物为纯 `<a>` 标签,无 `target`,点击在当前页跳转。`renderMarkdown` 同时被文章页和 `/api/preview` 后台预览接口共用。
- 站内链接一律使用相对路径(`/posts/x`、`/categories/x`、`/tags/x`),正文里不会出现绝对形式的本站链接。
- **后台 Server Action 模式**:`src/app/admin/posts/post-actions.ts` 用 `"use server"` + `FormData`(hidden input + `<form action>`),权限经 `requireUser()`/`canEditPost()`;`requireAdmin()` 已存在于 `src/lib/permissions.ts`,直接复用。删除等操作后调用 `revalidatePath` 刷新。
- **文章编辑页**:`src/app/admin/posts/[id]/edit/page.tsx`(server)取 post 后把数据塞进 `src/components/admin/PostEditor.tsx`(client)。`PostEditor` 主体是一个 `<form action={savePostAsDraft}>`,「保存草稿/发布」用 `formAction` 提交。编辑页当前**未展示** `viewCount`。
- **仪表盘对阅读数据的依赖**(`src/app/admin/page.tsx`):管理员「总阅读量」= `_sum(viewCount)`;「今日访问/近14日趋势」= `viewTrend()` 读 `DailyView(postId=null)`;「热门排行」按 `viewCount desc`。**重置单文若只清 `Post.viewCount` 不动 `DailyView`,该文按天聚合行会残留 → 趋势图与文章阅读数不一致**。
- **现成 modal**:项目无 modal/dialog 组件(`MobileSidebarDrawer` 是抽屉,非 modal;`design-previews/admin.html` 无 modal 样式)。需新建轻量内联确认 modal。

## 决策(已与用户确认)

| 决策点 | 选择 |
|--------|------|
| 去重实现位置 | 客户端 localStorage 窗口拉长到 5 小时(不改后端、不入库) |
| 预览不计数识别 | 预览链接加 `?preview=1`,ViewTracker 检测到该参数即跳过打点 |
| 新标签页范围 | 仅文章正文外链;站内导航(分类/标签/上下篇)保持同页 |
| 外链判定 | **不判 host**:凡是 `http://` 或 `https://` 开头的绝对链接一律视为外链,加 `target="_blank"`。相对路径/锚点/`mailto:`/`tel:` 不动 |
| 重置范围 | `Post.viewCount = 0` + 删除该文所有 `DailyView` 行(postId = 该文);不动全站 `DailyView(postId=null)`(该文历史访问已计入全站当日,重置不回溯修正全站趋势——可接受,见边界) |
| 重置入口 | 文章编辑页(`/admin/posts/[id]/edit`)内按钮,仅 ADMIN 可见;EDITOR 不可见 |
| 重置确认 | 自定义 React modal 二次确认,展示当前阅读数;确认后提交 server action |

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

重置阅读 admin/posts/[id]/edit
  └─ PostEditor(仅 ADMIN 区块) ──「重置阅读次数」按钮──► 自定义 modal 确认 ──► resetViews server action
        └─ requireAdmin() 校验 ──► 事务: Post.viewCount=0(保 updatedAt) + deleteMany DailyView(postId=该文)
              └─ revalidatePath('/admin') + revalidatePath('/admin/posts') + revalidatePath('/')
```

### D. 重置文章阅读次数(仅管理员)

**D1. Server Action — `src/app/admin/posts/post-actions.ts` 新增 `resetViews`**

```ts
export async function resetViews(formData: FormData): Promise<void> {
  const user = await requireAdmin();            // 仅 ADMIN
  const id = String(formData.get("id") || "");
  const post = await prisma.post.findUnique({ where: { id }, select: { updatedAt: true } });
  if (!post) return;
  await prisma.$transaction([
    prisma.post.update({
      where: { id },
      data: { viewCount: 0, updatedAt: post.updatedAt }, // 保 updatedAt,与 recordView 一致
    }),
    prisma.dailyView.deleteMany({ where: { postId: id } }),
  ]);
  revalidatePath("/admin");
  revalidatePath("/admin/posts");
  revalidatePath("/");
}
```

- 权限:`requireAdmin()` —— EDITOR 调用直接抛错(中间件虽未拦 `/admin/posts/[id]/edit`,但 action 内 `requireAdmin` 兜底,EDITOR 即便伪造表单提交也会被拒)。
- 范围:`Post.viewCount = 0` + `deleteMany DailyView where postId = id`。**不动全站 `DailyView(postId=null)`**:该文历史访问已计入全站当日计数,重置不回溯修正全站趋势(见边界)。
- `updatedAt`:显式写回原值,避免重置把文章「更新时间」顶到现在(与 `recordView` 同样的保 timestamp 处理)。
- `$transaction([update, deleteMany])`:数组形式顺序事务,两步原子。

**D2. 编辑页传参 — `src/app/admin/posts/[id]/edit/page.tsx`**

- `prisma.post.findUnique` 的 `select`/`include` 增加 `viewCount`(目前是全字段 include,直接可用 `post.viewCount`)。
- 给 `<PostEditor>` 新增 props:`viewCount: number`、`canReset: boolean`(= `user.role === "ADMIN"`)、`postId: post.id`(已有 `post.id` 透传,复用即可)。

**D3. PostEditor 新增「重置阅读」区块 — `src/components/admin/PostEditor.tsx`**

- `EditorPost` 类型新增 `viewCount?: number`(仅编辑已有文章时有)。
- props 新增 `canReset: boolean`。
- 在主 `</form>` **之外**(避免触发主表单提交)、页面底部新增一个独立 `<form action={resetViews}>` 区块,仅 `canReset && post.id` 时渲染:
  - 展示当前阅读数:`当前阅读 {formatViews(post.viewCount)}`。
  - 「重置阅读次数」按钮 → 打开确认 modal(不直接提交)。
  - hidden input `<input type="hidden" name="id" value={post.id} />`。
  - 从 `post-actions` 引入 `resetViews`。
- 该区块样式复用 `.panel` 容器,内部用项目 CSS 变量(`--aline`/`--aaccent`/`--soft`/`--amuted`)。

**D4. 自定义确认 modal — 新建 `src/components/admin/ConfirmDialog.tsx`**

轻量内联组件,无第三方依赖:

```tsx
"use client";
import { useEffect } from "react";

export function ConfirmDialog({
  open, title, description, confirmText = "确认", cancelText = "取消",
  onConfirm, onCancel,
}: {
  open: boolean; title: string; description: React.ReactNode;
  confirmText?: string; cancelText?: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3>{title}</h3>
        <div className="modal-body">{description}</div>
        <div className="modal-actions">
          <button type="button" className="btn sm" onClick={onCancel}>{cancelText}</button>
          <button type="button" className="btn primary sm" onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}
```

- `PostEditor` 内用 `useState<boolean>` 控制 open;点「重置阅读次数」→ `setResetOpen(true)`;modal 确认 → 提交 resetViews form(用 ref 取 form 调 `requestSubmit()`,或按钮 `type="submit"` + `form` 属性指向重置 form 的 id)。
- modal 文案:`title="重置阅读次数"`,`description` 显示「当前阅读 {N} 次,重置后该数据归零且无法恢复。」

**D5. 样式 — `src/styles/globals.css` 新增**

```css
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: var(--abg); border: 1px solid var(--aline); border-radius: 8px; padding: 20px 22px; max-width: 420px; width: calc(100% - 32px); box-shadow: 0 8px 32px rgba(0,0,0,.25); }
.modal h3 { margin: 0 0 10px; font-size: 15px; }
.modal-body { font-size: 13px; color: var(--soft); margin-bottom: 16px; line-height: 1.6; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; }
```

(实际变量名以 globals.css 现有为准,实现时核对。)

## 错误处理与边界

- **隐私模式 / 无 localStorage**:已有 try/catch,行为不变(按未计数处理,每次进入都计数)。本次不改。
- **`?preview=1` 被分享**:带该参数的链接被分享后,访客打开也不计数。影响极小,且与「预览不计数」语义一致。可接受。
- **外链判定**:
  - 相对链接(`/posts/x`)、锚点(`#toc`)、`mailto:`/`tel:` → 不动,保持当前页/默认行为。
  - `http://`/`https://` 绝对链接 → 一律新标签页。站内不会出现绝对本站链接(全用相对路径),无误伤。
  - 畸形 href:`typeof href === "string"` 守卫 + 正则,无 `new URL` 调用,不会抛错。
- **重置不回溯全站趋势**:`resetViews` 删该文 `DailyView(postId=id)` 行,但**不动** `DailyView(postId=null)` 全站当日计数。后果:重置后仪表盘「近14日趋势」中历史日期的全站合计仍含该文重置前的访问,而「总阅读量」(`_sum(viewCount)`)已归零 → 两者可能短暂不一致。这是有意取舍:回溯修正全站计数需逐天按该文当日量扣减,复杂且易错;历史趋势作为「当时真实访问」保留更有意义。可接受。
- **EDITOR 越权**:EDITOR 进入编辑页能看到文章(现有 `canEditPost` 允许编辑本人文章),但 `canReset=false` → 不渲染重置区块;即便伪造 form 提交 `resetViews`,`requireAdmin()` 抛错拒绝。
- **重置 form 与主 form 隔离**:重置 form 必须在主 `<form>` 之外,否则点重置会触发保存草稿。用独立 `<form action={resetViews}>` + hidden id。
- **modal 与表单提交**:确认后通过 `form.requestSubmit()` 触发 server action;取消/Esc/点 backdrop 关闭,不提交。

## 测试

- **`src/lib/views.test.ts`**:不涉及窗口长度与 preview 参数,无需改动,继续通过。
- **`src/lib/markdown.test.ts`**:**新增一条测试**。输入含外链 + 站内相对链接 + 锚点 + `mailto:` 的混合 markdown,断言:
  - 外链 `<a>` 含 `target="_blank"` 与 `rel="noopener noreferrer"`。
  - 相对链接、锚点、`mailto:` 的 `<a>` **不含** `target`。
- **`ViewTracker.tsx`**:暂不补单测(依赖 localStorage/fetch/window.location,纯客户端 useEffect,mock 成本高、收益低)。靠手动验证。
- **`resetViews`**(可选):mock prisma 事务,断言 `post.update` 传 `viewCount: 0` 且 `updatedAt` 保持原值,`dailyView.deleteMany` 传 `where: { postId: id }`。收益中等,视实现成本决定。
- **`ConfirmDialog.tsx`**:暂不补单测。靠手动验证。
- **手动验证清单**(实现后执行):
  1. 后台文章列表点「预览」→ 新标签打开文章 → 回后台列表刷新,「阅读」数不增。
  2. 同一文章 5 小时内重复进入 → 阅读数只增一次;清 localStorage 后再进 → 再增一次。
  3. 文章正文外链点击 → 新标签打开;站内链接、锚点 → 当前页/默认行为。
  4. ADMIN 进入文章编辑页 → 看到「当前阅读 N 次」+「重置阅读次数」按钮;点按钮 → modal 弹出显示 N → 确认 → 提交后回列表/编辑页,阅读数变 0;仪表盘该文热门排行与文章阅读数一致。
  5. EDITOR 进入本人文章编辑页 → **不出现**重置区块;伪造 form 提交 `resetViews` → 抛「需要管理员权限」。

## 不在范围内(YAGNI)

- 不引入服务端 IP 去重表 / 不改 `/api/view` 服务端逻辑。
- 不改 `DailyView` schema。
- 不改 `recordView`。
- 不对全站导航/侧栏/页脚链接做新标签页处理。
- 不给 `ViewTracker`/`ConfirmDialog` 加客户端单测。
- 重置不回溯修正全站 `DailyView(postId=null)` 趋势(见边界)。
- 不做批量重置(仅单篇,在编辑页内)。
