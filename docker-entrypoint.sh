#!/bin/sh
set -e

echo "[entrypoint] 应用数据库迁移…"
npx prisma migrate deploy

echo "[entrypoint] 初始化/校验种子数据（幂等）…"
npm run db:seed || echo "[entrypoint] seed 跳过或失败（可忽略，若数据已存在）"

echo "[entrypoint] 启动 Next.js…"
exec npm run start
