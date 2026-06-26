# 文章访问许可密钥 — 设计稿

日期：2026-06-26
状态：已确认，待生成实现计划

## 目标

为受保护文章提供「访问许可密钥」机制：管理员给某些文章上锁，读者打开时需输入正确密钥才能阅读。
项目没有读者账号，解锁状态保存在浏览器 cookie，保持 **7 天**，过期需重新输入。

管理员可：
- 给文章上锁，并设置解锁界面额外展示的说明（文章概要 / 为什么上锁 / 密钥获取途径）。
- 创建密钥（随机生成或自定义），配置其适用范围：可解锁哪些文章、最大使用次数、有效截止时间、启用开关、密钥级说明。
- 随时修改密钥及其全部配置、查看密钥明文、删除密钥。

权限：**只有管理员（ADMIN）能给文章上锁、能管理密钥**；编者（EDITOR）无此权限，需联系管理员。

## 核心选型：内容保护方式

采用 **服务端门禁**：文章被锁且读者未解锁时，服务器不渲染、不下发正文，只下发标题、摘要、封面与说明文字；解锁后才渲染正文。

否决的方案：
- 客户端隐藏（JS/CSS 盖住）——正文已下发，看源码/Network 即可拿到全文，等于没锁。
- 内容整段加密、浏览器端解密——破坏 SSR 与 markdown 渲染，密钥本就服务端可逆，收益不抵复杂度。

## 1. 数据模型（Prisma / SQLite）

`Post` 新增字段：
- `locked Boolean @default(false)` — 是否上锁
- `gateNote String?` — 文章级说明，解锁界面展示

新模型 `AccessKey`：

| 字段 | 类型 | 含义 |
|---|---|---|
| `id` | `String @id @default(cuid())` | 主键 |
| `label` | `String?` | 后台备注名，便于识别 |
| `secretEnc` | `String` | 密钥明文经 AES-256-GCM 加密后的密文（密钥由 `AUTH_SECRET` 派生），可逆，后台可解密查看明文 |
| `note` | `String?` | 密钥级说明，解锁成功后展示 |
| `maxUses` | `Int?` | 最大使用次数，`null` = 不限 |
| `usedCount` | `Int @default(0)` | 已成功解锁事件计数 |
| `validUntil` | `DateTime?` | 有效截止时间，`null` = 不过期 |
| `active` | `Boolean @default(true)` | 启用开关 |
| `createdAt` | `DateTime @default(now())` | |
| `updatedAt` | `DateTime @updatedAt` | |
| `posts` | `Post[]` 多对多关系 `"KeyPosts"` | 该密钥可解锁哪些文章 |

`Post` 侧加 `accessKeys AccessKey[] @relation("KeyPosts")`。
关系：一篇文章可被多把密钥解锁；一把密钥可解锁多篇文章。

加密实现：AES-256-GCM，密钥 = `sha256(AUTH_SECRET)`（32 字节）。存储格式 `base64(iv).base64(authTag).base64(ciphertext)`。仅服务端（`server-only`）。

## 2. 解锁状态 cookie

- 新 cookie `leublog_unlocks`，`httpOnly`，`sameSite=lax`，`secure` 跟随现有 `COOKIE_SECURE` 环境变量，`path=/`。
- 用 jose + `AUTH_SECRET` 签名（与现有会话同套机制）。
- 载荷：`{ u: { [postId]: { e: 到期epoch秒, k: 解锁所用keyId } } }`。
- 每次成功解锁：到期 = 当前 + 7 天，逐篇独立计时；读取时过滤掉已过期项后再判断。
- 存 `keyId` 用于解锁后展示该密钥的 `note`（可关闭的小横幅）。
- cookie `maxAge` 设 7 天；每次解锁会重写整张表。

辅助库 `src/lib/unlock-cookie.ts`：`readUnlocks()`、`grantUnlocks(postIds, keyId)`、`isUnlocked(postId)`，含过期过滤。

## 3. 解锁流程（语义已确认）

读者在受保护文章页输入密钥 → Server Action `unlockPost`：

1. 按 slug 取文章，必须 `locked && status=PUBLISHED`。
2. 找出**覆盖本文且 `active`** 的候选密钥；逐个解密，用 `timingSafeEqual` 与输入比对。
3. 命中后校验：未过 `validUntil`、`maxUses` 为 null 或 `usedCount < maxUses`。
4. 失败（无命中 / 已过期 / 次数用尽）→ 返回统一错误「密钥错误或已失效」，不泄露具体原因。
5. 成功：
   - 以**条件式原子自增**更新 `usedCount`（`update where id 且 (maxUses is null 或 usedCount < maxUses)`），防并发超限；若自增影响行数为 0（被并发抢光）则按失败处理。
   - **一次成功兑换 = `usedCount` +1，并把这把密钥当前覆盖的全部已发布文章一次性写进解锁 cookie**（读者输一次即可读完该密钥名下所有文章，整体计为一个解锁事件）。
   - 跳回文章页，正文正常渲染，顶部展示该密钥 `note` 横幅。

> 已确认语义：**输一次解锁该密钥名下全部文章、且只计 1 次使用**（而非每篇单独输入、每篇各计 1 次）。

## 4. 阅读端

- 文章页 `src/app/(reading)/posts/[slug]/page.tsx`（服务端）：
  - 取文章时附带 `locked`、`gateNote`。
  - `locked && !isUnlocked(post.id)` → 渲染 `ArticleGate`（标题/摘要/封面 + `gateNote` + 密钥输入框 + 错误提示），**不渲染、不下发正文**。
  - 否则正常渲染；若解锁所用密钥有 `note`，正文顶部显示可关闭横幅。
- 列表页（首页 / 归档 / 分类 / 标签）：上锁文章照常列出，标题/摘要/封面公开，加 🔒 角标；正文仅在文章页门禁。摘要应写成不剧透。

新组件 `src/components/reader/ArticleGate.tsx`（client，含密钥输入表单，调用 `unlockPost` Server Action）。

## 5. 后台

### 5A. 文章编辑页 —— 仅管理员可见的「访问控制」面板

- `PostEditor` 接收 `canLock`（= 当前用户为 ADMIN）prop，决定是否渲染面板：上锁开关 + `gateNote` 文本框。
- `persistPost`（`post-actions.ts`）：**仅当 `user.role === 'ADMIN'` 才采纳 `locked` / `gateNote` 字段**；编者提交时忽略这两个字段（保持原值）→ 编者无法上锁。

### 5B. 新增 `/admin/access-keys` 页（仅管理员）

- 列表：备注名、密钥明文（默认掩码，点击显示）、覆盖文章数、`usedCount/maxUses`、有效期、启用状态。
- 新建 / 编辑：
  - 密钥：随机生成（按钮）或自定义输入。
  - 备注名、密钥级说明、最大次数（空 = 不限）、有效截止（空 = 不过期）、启用开关。
  - 多选覆盖哪些文章（从已发布文章中选，可搜索）。
- 可随时修改密钥与全部配置；可删除密钥。
- 全部动作 `requireAdmin()` 守卫（`src/app/admin/access-keys/actions.ts`）。
- 软提示：上锁但无任何 active 密钥覆盖的文章 = 没人能解锁，提醒管理员。

### 5C. 路由与导航接入

- `src/middleware.ts` 的 `ADMIN_ONLY` 数组加 `/admin/access-keys`。
- `src/lib/permissions.ts` 的 `ADMIN_ONLY_PREFIXES` 加 `/admin/access-keys`；`navForRole` 在 ADMIN 的「系统」组加入「访问密钥」入口。

## 6. 权限要点

- 上锁严格限 ADMIN：`persistPost` 忽略非管理员的 `locked`/`gateNote`；密钥管理在 `ADMIN_ONLY` 中间件 + 各动作 `requireAdmin()` 双重守卫。编者无任何上锁能力。

## 7. 涉及文件

新增：
- `src/lib/access-keys.ts`（加解密 / 随机生成 / 校验）
- `src/lib/unlock-cookie.ts`（读写解锁 cookie）
- `src/app/admin/access-keys/page.tsx`、`actions.ts` 及表单客户端组件
- `src/app/(reading)/posts/[slug]/unlock-actions.ts`（`unlockPost` Server Action）
- `src/components/reader/ArticleGate.tsx`

改动：
- `prisma/schema.prisma`（+ 迁移）
- `src/middleware.ts`
- `src/lib/permissions.ts`
- `src/app/(reading)/posts/[slug]/page.tsx`（门禁逻辑）
- `src/app/admin/posts/post-actions.ts`（管理员专属 `locked`/`gateNote`）
- `src/components/admin/PostEditor.tsx` 及文章新建/编辑页（访问控制面板）
- 列表页组件（🔒 角标）

## 8. 测试要点

- 加解密：`encrypt→decrypt` 往返一致；错误密钥比对失败。
- 解锁流程：正确密钥解锁；错误/过期/次数用尽统一报错；`usedCount` 并发不超限；一次兑换解锁该密钥全部覆盖文章并只 +1。
- cookie：7 天内重复访问不再扣次数；过期项被过滤、需重新输入。
- 权限：编者提交 `locked`/`gateNote` 被忽略；非管理员访问 `/admin/access-keys` 被中间件挡回。
- 门禁：未解锁时正文不在服务端响应里（Network/源码不可见）。
- 列表：上锁文章仍列出、带锁角标，摘要可见、正文不可见。

## 9. 修订（2026-06-27，迭代 2）

依据使用反馈调整（实现已更新，本节为准）：

- **锁图标**：🔒 emoji 与站点单色几何图标风格不搭，统一改为 `⊘`（导航、阅读端门禁、列表角标）。
- **覆盖范围指派方向反转**：不再在「访问密钥」页勾选该密钥覆盖哪些文章；改为在**文章编辑页**（仅管理员）多选「可解锁本文的密钥」，经 `persistPost` 以 `accessKeys`（create 用 `connect`、update 用 `set`，均仅管理员）写入。`createAccessKey`/`updateAccessKey` 不再触碰 `posts`（否则改配置会清空覆盖）。
- **访问密钥页**：每把密钥展示为**紧凑卡片**（折叠），卡内可「显示密钥/编辑（展开配置表单）/重置次数/删除」，并列出**已应用文章**，每篇可一键 `撤销`（新动作 `revokeCoverage`，disconnect 关系）。密钥表单变为纯配置（无文章勾选）。
- **未分组标签管理**：标签组删除后其标签因 `onDelete: SetNull` 变为孤儿（`tagGroupId=null`），原页面不可见且其唯一 `name` 阻止重建同名标签。新增「未分组标签」面板：可删除孤儿标签，或经 `assignTagGroup` 重新分配到某标签组。`SetNull` 行为保持不变。
