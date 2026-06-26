-- CreateTable
CREATE TABLE "AccessKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT,
    "secretEnc" TEXT NOT NULL,
    "note" TEXT,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "validUntil" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "_KeyPosts" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_KeyPosts_A_fkey" FOREIGN KEY ("A") REFERENCES "AccessKey" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_KeyPosts_B_fkey" FOREIGN KEY ("B") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "excerpt" TEXT,
    "coverImage" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "gateNote" TEXT,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "authorId" TEXT NOT NULL,
    "categoryId" TEXT,
    CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Post_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Post" ("authorId", "categoryId", "content", "coverImage", "createdAt", "excerpt", "id", "publishedAt", "slug", "status", "title", "updatedAt", "viewCount") SELECT "authorId", "categoryId", "content", "coverImage", "createdAt", "excerpt", "id", "publishedAt", "slug", "status", "title", "updatedAt", "viewCount" FROM "Post";
DROP TABLE "Post";
ALTER TABLE "new_Post" RENAME TO "Post";
CREATE UNIQUE INDEX "Post_slug_key" ON "Post"("slug");
CREATE INDEX "Post_status_publishedAt_idx" ON "Post"("status", "publishedAt");
CREATE INDEX "Post_authorId_idx" ON "Post"("authorId");
CREATE INDEX "Post_categoryId_idx" ON "Post"("categoryId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AccessKey_active_idx" ON "AccessKey"("active");

-- CreateIndex
CREATE UNIQUE INDEX "_KeyPosts_AB_unique" ON "_KeyPosts"("A", "B");

-- CreateIndex
CREATE INDEX "_KeyPosts_B_index" ON "_KeyPosts"("B");
