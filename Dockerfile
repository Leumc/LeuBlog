# ---------- 构建阶段 ----------
FROM node:22-alpine AS builder
WORKDIR /app

# 安装全部依赖（含构建期）
COPY package.json package-lock.json ./
RUN npm ci

# 生成 Prisma Client 并构建
# SQLite 占位 + prisma db push 建表，让 next build 的静态生成查询能命中空表
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:/tmp/build-placeholder.db"
RUN npx prisma generate && npx prisma db push --skip-generate && npx next build && rm -f /tmp/build-placeholder.db

# ---------- 运行阶段 ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# 仅安装运行期依赖（含 prisma CLI 与 tsx，用于迁移与 seed）
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 拷贝构建产物与运行所需文件
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY next.config.mjs ./

# 运行期重新生成 Prisma Client（匹配 omit=dev 后的 node_modules）
RUN npx prisma generate

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
