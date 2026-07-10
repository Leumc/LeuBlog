import "server-only";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { randomStorageName, resolveUploadDirectory } from "@/lib/uploads";

export async function ensureCategoryDirectory(categoryId: string | null): Promise<string> {
  if (!categoryId) return "";
  const category = await prisma.mediaCategory.findUnique({
    where: { id: categoryId },
    include: { storage: true },
  });
  if (!category) throw new Error("目标文件夹不存在");

  const parentDir = await ensureCategoryDirectory(category.parentId);
  let storageName = category.storage?.storageName;
  if (!storageName) {
    for (let attempt = 0; attempt < 5 && !storageName; attempt += 1) {
      const candidate = randomStorageName();
      try {
        await prisma.mediaStorageFolder.create({ data: { categoryId, storageName: candidate } });
        storageName = candidate;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          const existing = await prisma.mediaStorageFolder.findUnique({ where: { categoryId } });
          if (existing) storageName = existing.storageName;
          continue;
        }
        throw error;
      }
    }
  }
  if (!storageName) throw new Error("无法生成文件夹存储目录");
  const relativeDir = parentDir ? `${parentDir}/${storageName}` : storageName;
  const full = resolveUploadDirectory(relativeDir);
  if (!full) throw new Error("文件夹路径无效");
  await mkdir(full, { recursive: true });
  return relativeDir;
}

export function assetRelativePath(asset: { filename: string; storage?: { relativePath: string } | null }): string {
  return asset.storage?.relativePath || asset.filename;
}

export async function createPhysicalFolder(name: string, parentId: string | null) {
  const category = await prisma.mediaCategory.create({ data: { name, parentId } });
  try {
    await ensureCategoryDirectory(category.id);
    return category;
  } catch (error) {
    await prisma.mediaCategory.delete({ where: { id: category.id } }).catch(() => undefined);
    throw error;
  }
}

export function joinMediaPath(relativeDir: string, filename: string): string {
  return relativeDir ? path.posix.join(relativeDir, filename) : filename;
}
