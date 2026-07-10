-- CreateTable
CREATE TABLE IF NOT EXISTS "MediaCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "parentId" TEXT,
    CONSTRAINT "MediaCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "MediaCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MediaAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "categoryId" TEXT,
    CONSTRAINT "MediaAsset_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MediaCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MediaCategory_parentId_name_key" ON "MediaCategory"("parentId", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MediaCategory_parentId_idx" ON "MediaCategory"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MediaAsset_filename_key" ON "MediaAsset"("filename");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MediaAsset_categoryId_idx" ON "MediaAsset"("categoryId");
