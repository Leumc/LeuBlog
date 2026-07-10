"use server";

import { rename, rm, unlink } from "node:fs/promises";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ensureMediaSchema } from "@/lib/media-schema";
import { assetRelativePath, createPhysicalFolder, ensureCategoryDirectory, joinMediaPath } from "@/lib/media-storage";
import { randomStorageName, resolveUploadDirectory, resolveUploadPath, uploadUrl } from "@/lib/uploads";

function refreshMedia() {
  revalidatePath("/admin/media");
}

async function moveAsset(assetId: string, categoryId: string | null): Promise<void> {
  const asset = await prisma.mediaAsset.findUnique({
    where: { id: assetId },
    include: { storage: true },
  });
  if (!asset) throw new Error("图片不存在");
  if (categoryId) {
    const category = await prisma.mediaCategory.findUnique({ where: { id: categoryId }, select: { id: true } });
    if (!category) throw new Error("目标文件夹不存在");
  }

  const oldRelativePath = assetRelativePath(asset);
  const targetDir = await ensureCategoryDirectory(categoryId);
  const newRelativePath = joinMediaPath(targetDir, asset.filename);
  if (oldRelativePath === newRelativePath) {
    await prisma.mediaAsset.update({ where: { id: asset.id }, data: { categoryId } });
    return;
  }

  const oldPath = resolveUploadPath(oldRelativePath);
  const newPath = resolveUploadPath(newRelativePath);
  if (!oldPath || !newPath) throw new Error("图片路径无效");
  if (!resolveUploadDirectory(targetDir)) throw new Error("目标文件夹路径无效");

  const oldUrl = uploadUrl(oldRelativePath);
  const newUrl = uploadUrl(newRelativePath);
  const posts = await prisma.post.findMany({
    where: { OR: [{ content: { contains: oldUrl } }, { coverImage: { contains: oldUrl } }] },
    select: { id: true, slug: true, content: true, coverImage: true, updatedAt: true },
  });

  await rename(oldPath, newPath);
  try {
    await prisma.$transaction([
      prisma.mediaAsset.update({ where: { id: asset.id }, data: { categoryId } }),
      prisma.mediaStorageAsset.upsert({
        where: { assetId: asset.id },
        create: { assetId: asset.id, relativePath: newRelativePath },
        update: { relativePath: newRelativePath },
      }),
      ...posts.map((post) => prisma.post.update({
        where: { id: post.id },
        data: {
          content: post.content.replaceAll(oldUrl, newUrl),
          coverImage: post.coverImage?.replaceAll(oldUrl, newUrl) ?? null,
          updatedAt: post.updatedAt,
        },
      })),
    ]);
  } catch (error) {
    await rename(newPath, oldPath).catch(() => undefined);
    throw error;
  }

  posts.forEach((post) => {
    revalidatePath(`/posts/${post.slug}`);
    revalidatePath(`/admin/posts/${post.id}/edit`);
  });
  if (posts.length) {
    revalidatePath("/admin/posts");
    revalidatePath("/");
  }
}

export async function renameMedia(formData: FormData): Promise<void> {
  await requireAdmin();
  await ensureMediaSchema();
  const id = String(formData.get("id") || "");
  const displayName = String(formData.get("displayName") || "").trim().slice(0, 160);
  if (!id || !displayName) throw new Error("显示名不能为空");
  await prisma.mediaAsset.update({ where: { id }, data: { displayName } });
  refreshMedia();
}

export async function moveMedia(formData: FormData): Promise<void> {
  await requireAdmin();
  await ensureMediaSchema();
  const id = String(formData.get("id") || "");
  const categoryId = String(formData.get("categoryId") || "").trim() || null;
  if (!id) return;
  await moveAsset(id, categoryId);
  refreshMedia();
}

export async function deleteMedia(formData: FormData): Promise<void> {
  await requireAdmin();
  await ensureMediaSchema();
  const id = String(formData.get("id") || "");
  const asset = await prisma.mediaAsset.findUnique({ where: { id }, include: { storage: true } });
  if (!asset) return;
  const full = resolveUploadPath(assetRelativePath(asset));
  if (!full) throw new Error("图片路径无效");
  const quarantine = `${full}.deleting-${randomStorageName(4)}`;
  let quarantined = false;
  try {
    await rename(full, quarantine);
    quarantined = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  try {
    await prisma.mediaAsset.delete({ where: { id } });
  } catch (error) {
    if (quarantined) await rename(quarantine, full).catch(() => undefined);
    throw error;
  }
  if (quarantined) await unlink(quarantine).catch(() => undefined);
  refreshMedia();
}

export async function createMediaCategory(formData: FormData): Promise<void> {
  await requireAdmin();
  await ensureMediaSchema();
  const name = String(formData.get("name") || "").trim().slice(0, 80);
  const requestedParentId = String(formData.get("parentId") || "").trim() || null;
  if (!name) throw new Error("文件夹名称不能为空");
  if (requestedParentId) {
    const parent = await prisma.mediaCategory.findUnique({ where: { id: requestedParentId }, select: { id: true } });
    if (!parent) throw new Error("上级文件夹不存在");
  }
  await createPhysicalFolder(name, requestedParentId);
  refreshMedia();
}

export async function deleteMediaCategory(formData: FormData): Promise<void> {
  await requireAdmin();
  await ensureMediaSchema();
  const id = String(formData.get("id") || "");
  if (!id) return;

  const allCategories = await prisma.mediaCategory.findMany({ select: { id: true, parentId: true } });
  const descendants = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const category of allCategories) {
      if (category.parentId && descendants.has(category.parentId) && !descendants.has(category.id)) {
        descendants.add(category.id);
        changed = true;
      }
    }
  }

  const assets = await prisma.mediaAsset.findMany({
    where: { categoryId: { in: [...descendants] } },
    select: { id: true },
  });
  for (const asset of assets) await moveAsset(asset.id, null);

  const directory = await ensureCategoryDirectory(id);
  const fullDirectory = resolveUploadDirectory(directory);
  await prisma.mediaCategory.delete({ where: { id } });
  if (fullDirectory) await rm(fullDirectory, { recursive: true, force: true }).catch(() => undefined);
  refreshMedia();
}

export async function organizeLegacyMedia(): Promise<void> {
  await requireAdmin();
  await ensureMediaSchema();
  const assets = await prisma.mediaAsset.findMany({
    where: { categoryId: { not: null } },
    include: { storage: true },
  });
  for (const asset of assets) {
    if (asset.categoryId && assetRelativePath(asset) === asset.filename) {
      await moveAsset(asset.id, asset.categoryId);
    }
  }
  refreshMedia();
}
