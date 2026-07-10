import path from "node:path";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { ensureMediaSchema } from "@/lib/media-schema";
import { backfillMediaReferences } from "@/lib/media-references";
import { assetRelativePath, ensureCategoryDirectory } from "@/lib/media-storage";
import { uploadUrl, walkUploadFiles } from "@/lib/uploads";
import MediaUploader from "./MediaUploader";
import MediaBrowser, { type BrowserFile, type BrowserFolder } from "./MediaBrowser";

export const dynamic = "force-dynamic";

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string; category?: string }>;
}) {
  await requireAdmin();
  await ensureMediaSchema();
  const query = await searchParams;
  const requestedFolderId = query.folder || query.category || null;

  const categories = await prisma.mediaCategory.findMany({
    orderBy: { name: "asc" },
    include: { storage: true },
  });
  const categoryIds = new Set(categories.map((category) => category.id));
  const currentFolderId = requestedFolderId && categoryIds.has(requestedFolderId)
    ? requestedFolderId
    : null;

  // 为旧分类补齐随机物理目录，但不会静默移动已有图片。
  const directoryByCategory = new Map<string, string>();
  for (const category of categories) {
    directoryByCategory.set(category.id, await ensureCategoryDirectory(category.id));
  }
  const categoryByDirectory = new Map(
    [...directoryByCategory.entries()].map(([id, directory]) => [directory, id]),
  );

  const diskFiles = await walkUploadFiles();
  const assets = await prisma.mediaAsset.findMany({ include: { storage: true } });
  const assetByPath = new Map(assets.map((asset) => [assetRelativePath(asset), asset]));
  const legacyByFilename = new Map(
    assets.filter((asset) => !asset.storage).map((asset) => [asset.filename, asset]),
  );

  // 兼容直接放入 uploads 的旧图片与运维导入图片。
  for (const diskFile of diskFiles) {
    if (assetByPath.has(diskFile.relativePath)) continue;
    const legacy = legacyByFilename.get(diskFile.filename);
    const categoryId = categoryByDirectory.get(path.posix.dirname(diskFile.relativePath).replace(/^\.$/, "")) ?? null;
    if (legacy) {
      await prisma.$transaction([
        prisma.mediaStorageAsset.create({
          data: { assetId: legacy.id, relativePath: diskFile.relativePath },
        }),
        prisma.mediaAsset.update({ where: { id: legacy.id }, data: { categoryId } }),
      ]);
    } else {
      await prisma.mediaAsset.create({
        data: {
          filename: diskFile.filename,
          displayName: diskFile.filename,
          categoryId,
          storage: { create: { relativePath: diskFile.relativePath } },
        },
      }).catch(() => undefined);
    }
  }

  await backfillMediaReferences();
  const finalAssets = await prisma.mediaAsset.findMany({
    include: {
      storage: true,
      references: {
        include: { post: { select: { id: true, title: true, slug: true, status: true } } },
      },
    },
  });
  const diskByPath = new Map(diskFiles.map((file) => [file.relativePath, file]));

  const children: BrowserFolder[] = categories
    .filter((category) => category.parentId === currentFolderId)
    .map((category) => ({
      id: category.id,
      name: category.name,
      childCount: categories.filter((item) => item.parentId === category.id).length,
      assetCount: finalAssets.filter((asset) => asset.categoryId === category.id).length,
    }));

  const files: BrowserFile[] = finalAssets
    .filter((asset) => asset.categoryId === currentFolderId)
    .flatMap((asset) => {
      const relativePath = assetRelativePath(asset);
      const disk = diskByPath.get(relativePath);
      if (!disk) return [];
      return [{
        id: asset.id,
        displayName: asset.displayName || asset.filename,
        filename: asset.filename,
        relativePath,
        url: uploadUrl(relativePath),
        size: disk.size,
        mtime: disk.mtime,
        references: asset.references.map((reference) => reference.post),
      }];
    })
    .sort((a, b) => b.mtime - a.mtime);
  const legacyOrganizeCount = finalAssets.filter(
    (asset) => asset.categoryId && assetRelativePath(asset) === asset.filename,
  ).length;

  const byId = new Map(categories.map((category) => [category.id, category]));
  const breadcrumbs: { id: string | null; name: string }[] = [{ id: null, name: "媒体库" }];
  const chain = [];
  let cursor = currentFolderId ? byId.get(currentFolderId) : undefined;
  while (cursor) {
    chain.unshift({ id: cursor.id, name: cursor.name });
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  breadcrumbs.push(...chain);

  const folderPath = (id: string): string[] => {
    const names: string[] = [];
    let item = byId.get(id);
    while (item) {
      names.unshift(item.name);
      item = item.parentId ? byId.get(item.parentId) : undefined;
    }
    return names;
  };
  const allFolders = categories.map((category) => ({
    id: category.id,
    name: folderPath(category.id).join(" / "),
  }));

  const totalMB = diskFiles.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024;
  return (
    <div className="panel">
      <div className="h">
        <h2>媒体库</h2>
        <span className="right" style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--soft)" }}>
          已用 {totalMB.toFixed(1)} MB · 共 {diskFiles.length} 个文件
        </span>
      </div>
      <div className="b">
        <MediaUploader categoryId={currentFolderId ?? undefined} />
        <MediaBrowser
          currentFolderId={currentFolderId}
          breadcrumbs={breadcrumbs}
          folders={children}
          allFolders={allFolders}
          files={files}
          legacyOrganizeCount={legacyOrganizeCount}
        />
      </div>
    </div>
  );
}
