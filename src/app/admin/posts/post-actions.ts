"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, canEditPost } from "@/lib/permissions";
import { slugify } from "@/lib/utils";
import { makeExcerpt } from "@/lib/markdown";

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  let slug = base;
  let i = 1;
  while (true) {
    const existing = await prisma.post.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${base}-${i++}`;
  }
}

async function persistPost(formData: FormData, status: "DRAFT" | "PUBLISHED"): Promise<void> {
  const user = await requireUser();

  const id = String(formData.get("id") || "");
  const title = String(formData.get("title") || "").trim();
  const content = String(formData.get("content") || "");
  const slugInput = String(formData.get("slug") || "").trim();
  const excerptInput = String(formData.get("excerpt") || "").trim();
  const categoryId = String(formData.get("categoryId") || "") || null;
  const tagIds = JSON.parse(String(formData.get("tagIds") || "[]")) as string[];

  const isAdmin = user.role === "ADMIN";
  const lockFields = isAdmin
    ? {
        locked: formData.get("locked") === "true",
        gateNote: String(formData.get("gateNote") || "").trim() || null,
      }
    : {};

  if (!title) throw new Error("标题不能为空");

  const baseSlug = slugify(slugInput || title);
  const excerpt = excerptInput || makeExcerpt(content);

  if (id) {
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) throw new Error("文章不存在");
    if (!canEditPost(user, post.authorId)) throw new Error("无权编辑该文章");

    const slug = await uniqueSlug(baseSlug, id);
    const wasPublished = post.status === "PUBLISHED";
    await prisma.post.update({
      where: { id },
      data: {
        title,
        slug,
        content,
        excerpt,
        categoryId,
        status,
        publishedAt:
          status === "PUBLISHED" && !wasPublished ? new Date() : post.publishedAt,
        tags: { set: tagIds.map((t) => ({ id: t })) },
        ...lockFields,
      },
    });
  } else {
    const slug = await uniqueSlug(baseSlug);
    await prisma.post.create({
      data: {
        title,
        slug,
        content,
        excerpt,
        categoryId,
        status,
        publishedAt: status === "PUBLISHED" ? new Date() : null,
        authorId: user.id,
        tags: { connect: tagIds.map((t) => ({ id: t })) },
        ...lockFields,
      },
    });
  }

  revalidatePath("/admin/posts");
  revalidatePath("/");
  redirect("/admin/posts");
}

export async function savePostAsDraft(formData: FormData): Promise<void> {
  return persistPost(formData, "DRAFT");
}

export async function publishPost(formData: FormData): Promise<void> {
  return persistPost(formData, "PUBLISHED");
}

export async function deletePost(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") || "");
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) return;
  if (!canEditPost(user, post.authorId)) throw new Error("无权删除该文章");
  await prisma.post.delete({ where: { id } });
  revalidatePath("/admin/posts");
  revalidatePath("/");
}
