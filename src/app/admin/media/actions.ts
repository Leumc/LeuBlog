"use server";

import { unlink } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/permissions";
import { UPLOAD_DIR } from "@/lib/uploads";
import { prisma } from "@/lib/prisma";
import { ensureMediaSchema } from "@/lib/media-schema";

function mediaPath(name: string): string | null {
  if (!name || name.includes("/") || name.includes("\\") || name.includes("..")) return null;
  return path.join(UPLOAD_DIR, name);
}

function rv() {
  revalidatePath("/admin/media");
}

export async function deleteMedia(formData: FormData): Promise<void> {
  await requireAdmin();
  await ensureMediaSchema();
  const name = String(formData.get("name") || "");
  const full = mediaPath(name);
  if (!full) return;
  try {
    await unlink(full);
  } catch {
    /* ignore */
  }
  await prisma.mediaAsset.deleteMany({ where: { filename: name } });
  rv();
}

export async function updateMediaMetadata(formData: FormData): Promise<void> {
  await requireAdmin();
  await ensureMediaSchema();
  const filename = String(formData.get("filename") || "");
  if (!mediaPath(filename)) return;

  const displayName = String(formData.get("displayName") || "").trim().slice(0, 160) || null;
  const requestedCategoryId = String(formData.get("categoryId") || "").trim() || null;
  const category = requestedCategoryId
    ? await prisma.mediaCategory.findUnique({ where: { id: requestedCategoryId }, select: { id: true } })
    : null;
  const categoryId = category?.id ?? null;

  await prisma.mediaAsset.upsert({
    where: { filename },
    create: { filename, displayName, categoryId },
    update: { displayName, categoryId },
  });
  rv();
}

export async function createMediaCategory(formData: FormData): Promise<void> {
  await requireAdmin();
  await ensureMediaSchema();
  const name = String(formData.get("name") || "").trim().slice(0, 80);
  const requestedParentId = String(formData.get("parentId") || "").trim() || null;
  if (!name) return;
  const parent = requestedParentId
    ? await prisma.mediaCategory.findUnique({ where: { id: requestedParentId }, select: { id: true } })
    : null;
  await prisma.mediaCategory.create({ data: { name, parentId: parent?.id ?? null } });
  rv();
}

export async function deleteMediaCategory(formData: FormData): Promise<void> {
  await requireAdmin();
  await ensureMediaSchema();
  const id = String(formData.get("id") || "");
  if (!id) return;
  await prisma.mediaCategory.deleteMany({ where: { id } });
  rv();
}
