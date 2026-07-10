-- 新表承载物理路径与引用关系，避免修改旧媒体表造成运行时兼容问题。
CREATE TABLE IF NOT EXISTS "MediaStorageFolder" (
    "categoryId" TEXT NOT NULL PRIMARY KEY,
    "storageName" TEXT NOT NULL,
    CONSTRAINT "MediaStorageFolder_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MediaCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "MediaStorageAsset" (
    "assetId" TEXT NOT NULL PRIMARY KEY,
    "relativePath" TEXT NOT NULL,
    CONSTRAINT "MediaStorageAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MediaAsset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "MediaReference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assetId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    CONSTRAINT "MediaReference_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MediaAsset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MediaReference_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "MediaStorageFolder_storageName_key" ON "MediaStorageFolder"("storageName");
CREATE UNIQUE INDEX IF NOT EXISTS "MediaStorageAsset_relativePath_key" ON "MediaStorageAsset"("relativePath");
CREATE UNIQUE INDEX IF NOT EXISTS "MediaReference_assetId_postId_key" ON "MediaReference"("assetId", "postId");
CREATE INDEX IF NOT EXISTS "MediaReference_postId_idx" ON "MediaReference"("postId");
