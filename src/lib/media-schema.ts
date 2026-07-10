import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * 兼容尚未执行新迁移的旧数据库。
 *
 * Docker 启动仍以 `prisma migrate deploy` 为正式升级路径；这里是运行时兜底，
 * 避免本地旧库或非 Docker 部署在首次访问媒体库时因缺表直接崩溃。
 * 所有语句均为幂等 DDL，之后再执行正式迁移也不会冲突。
 */
const MEDIA_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "MediaCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "parentId" TEXT,
    CONSTRAINT "MediaCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "MediaCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "MediaAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "categoryId" TEXT,
    CONSTRAINT "MediaAsset_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MediaCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "MediaCategory_parentId_name_key" ON "MediaCategory"("parentId", "name")`,
  `CREATE INDEX IF NOT EXISTS "MediaCategory_parentId_idx" ON "MediaCategory"("parentId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "MediaAsset_filename_key" ON "MediaAsset"("filename")`,
  `CREATE INDEX IF NOT EXISTS "MediaAsset_categoryId_idx" ON "MediaAsset"("categoryId")`,
] as const;

let initialization: Promise<void> | null = null;

export function ensureMediaSchema(): Promise<void> {
  if (!initialization) {
    initialization = (async () => {
      const existing = await prisma.$queryRawUnsafe<{ name: string }[]>(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name IN ('MediaCategory', 'MediaAsset')`,
      );
      if (existing.length === 2) return;

      await prisma.$transaction(
        MEDIA_SCHEMA_STATEMENTS.map((sql) => prisma.$executeRawUnsafe(sql)),
      );
    })()
      .catch((error) => {
        // 允许数据库临时锁定等可恢复错误在下一次请求重试。
        initialization = null;
        throw error;
      });
  }
  return initialization;
}
