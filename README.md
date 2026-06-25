# LeuBlog

个人技术 / 算法博客。读者侧只读（无登录、无评论），写作侧为多编者后台。
杂志质感设计：衬线字体、线条分割、暖纸底叠点阵。面向 **2 核 2G 轻量 VPS**。

## 功能

- **阅读系统**：Markdown + LaTeX(KaTeX) + 服务端代码高亮(Shiki) + 复制按钮 + 图片 + 自动目录
- **公告**：克制的线条式公告条，支持时效窗口
- **后台**：仪表盘（内容统计 / 访问趋势 / 热门排行 / 最近活动）
- **编辑器**：CodeMirror + 实时预览（复用阅读端渲染管线），图片上传
- **传送门**：外链（友链 / 我的站点），可配置展示在侧栏或页脚
- **用户**：管理员全站唯一，可创建/禁用/重置编者；编者仅能管理本人文章
- **分类法**：文章分组 → 标签组 → 标签 三级结构；分组/标签/归档浏览页

## 技术栈

Next.js 15 (App Router, TS) · SQLite + Prisma · 自建 JWT 会话(jose + bcrypt) ·
Tailwind CSS · unified(remark/rehype) 渲染管线 · Docker Compose + Nginx。

## 本地开发

```bash
npm install
cp .env.example .env        # 修改 AUTH_SECRET / ADMIN_* 等
npx prisma migrate dev      # 初始化数据库
npm run db:seed             # 写入管理员、站点设置、示例文章
npm run dev                 # http://localhost:3000
```

后台入口 `http://localhost:3000/admin`，用 `.env` 中的 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 登录。

## 部署（Docker Compose）

```bash
cp .env.example .env        # 必填 AUTH_SECRET（openssl rand -base64 48），改默认管理员密码
docker compose up -d --build
```

- 站点：`http://<服务器IP>/`（Nginx 80 端口反代到应用）
- 持久化卷：`./data`（SQLite 文件）、`./uploads`（图片）
- 启动时自动执行 `prisma migrate deploy` 与幂等 seed（首次创建管理员）
- HTTPS：在 `nginx/nginx.conf` 增加 443 + 证书，或在其前面再加一层（Caddy / Cloudflare）

> **2G 内存构建提示**：`next build` 峰值内存较高。若在 VPS 上直接 `--build` 出现 OOM，
> 建议为系统添加 1–2G swap，或在本机构建镜像后推送到服务器。

### 字体（可选自托管）

默认使用系统衬线栈（Noto Serif SC → Songti → Georgia）。如需自托管中文衬线，
将 woff2 放入 `public/fonts/` 并取消 `src/styles/globals.css` 中 `@font-face` 注释。

## 目录要点

```
src/app/(public)/   读者侧页面（首页/文章/分组/标签/归档/关于）
src/app/admin/      后台（登录/仪表盘/文章/分类法/用户/公告/传送门/媒体/设置）
src/app/api/        view 打点 / preview 预览 / upload 上传
src/lib/            prisma · auth · permissions · markdown · settings · views
src/components/     reader/* 与 admin/*
prisma/             schema + migrations + seed
design-previews/    设计定稿存档（不参与构建，仅供参考）
```

## 权限模型

- `ADMIN`（唯一）：全部后台板块（概览 / 内容 / 运营 / 系统）。
- `EDITOR`：仅「概览」「内容」；运营与系统板块在导航中不渲染，并由 `middleware.ts` 拦截路由。
- 读者：无需账号。
