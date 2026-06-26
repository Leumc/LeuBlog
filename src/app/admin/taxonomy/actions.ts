"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { slugify } from "@/lib/utils";

function rv() {
  revalidatePath("/admin/taxonomy");
  revalidatePath("/categories");
  revalidatePath("/tags");
}

async function uniqueSlug(
  base: string,
  model: "category" | "tagGroup" | "tag",
): Promise<string> {
  let slug = base || "x";
  let i = 1;
  while (true) {
    // @ts-expect-error 动态模型访问
    const found = await prisma[model].findUnique({ where: { slug } });
    if (!found) return slug;
    slug = `${base}-${i++}`;
  }
}

export async function createCategory(formData: FormData): Promise<void> {
  await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  await prisma.category.create({
    data: {
      name,
      slug: await uniqueSlug(slugify(name), "category"),
      description: String(formData.get("description") || "").trim() || null,
      order: parseInt(String(formData.get("order") || "0"), 10) || 0,
    },
  });
  rv();
}

export async function deleteCategory(formData: FormData): Promise<void> {
  await requireAdmin();
  await prisma.category.delete({ where: { id: String(formData.get("id") || "") } });
  rv();
}

export async function createTagGroup(formData: FormData): Promise<void> {
  await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  const categoryId = String(formData.get("categoryId") || "");
  if (!name || !categoryId) return;
  await prisma.tagGroup.create({
    data: {
      name,
      slug: await uniqueSlug(slugify(name), "tagGroup"),
      categoryId,
      order: parseInt(String(formData.get("order") || "0"), 10) || 0,
    },
  });
  rv();
}

export async function deleteTagGroup(formData: FormData): Promise<void> {
  await requireAdmin();
  await prisma.tagGroup.delete({ where: { id: String(formData.get("id") || "") } });
  rv();
}

export async function createTag(formData: FormData): Promise<void> {
  await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const tagGroupId = String(formData.get("tagGroupId") || "") || null;
  await prisma.tag.create({
    data: {
      name,
      slug: await uniqueSlug(slugify(name), "tag"),
      tagGroupId,
    },
  });
  rv();
}

export async function deleteTag(formData: FormData): Promise<void> {
  await requireAdmin();
  await prisma.tag.delete({ where: { id: String(formData.get("id") || "") } });
  rv();
}

export async function assignTagGroup(formData: FormData): Promise<void> {
  await requireAdmin();
  const tagId = String(formData.get("tagId") || "");
  const tagGroupId = String(formData.get("tagGroupId") || "");
  if (!tagId || !tagGroupId) return;
  await prisma.tag.update({ where: { id: tagId }, data: { tagGroupId } });
  rv();
}
