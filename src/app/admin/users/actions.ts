"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { hashPassword } from "@/lib/auth";

export type UserActionState = { error?: string; ok?: string };

export async function createEditor(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  await requireAdmin();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const username = String(formData.get("username") || "").trim();
  const displayName = String(formData.get("displayName") || "").trim() || username;
  const password = String(formData.get("password") || "");

  if (!email || !username || !password) {
    return { error: "邮箱、用户名、密码均为必填" };
  }
  if (password.length < 6) return { error: "密码至少 6 位" };

  const dup = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (dup) return { error: "邮箱或用户名已存在" };

  await prisma.user.create({
    data: {
      email,
      username,
      displayName,
      passwordHash: await hashPassword(password),
      role: "EDITOR", // 只能创建编者；管理员全站唯一
    },
  });
  revalidatePath("/admin/users");
  return { ok: `已创建编者 ${username}` };
}

export async function toggleUserActive(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u || u.role === "ADMIN") return; // 不可禁用管理员
  await prisma.user.update({ where: { id }, data: { active: !u.active } });
  revalidatePath("/admin/users");
}

export async function resetPassword(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const pwd = String(formData.get("password") || "");
  if (pwd.length < 6) return;
  await prisma.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(pwd) },
  });
  revalidatePath("/admin/users");
}

export async function deleteUser(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const u = await prisma.user.findUnique({
    where: { id },
    include: { _count: { select: { posts: true } } },
  });
  if (!u || u.role === "ADMIN") return; // 不可删除管理员
  if (u._count.posts > 0) return; // 有文章的编者不直接删除，先转移或删文章
  await prisma.user.delete({ where: { id } });
  revalidatePath("/admin/users");
}
