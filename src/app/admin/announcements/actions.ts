"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";

export async function createAnnouncement(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const content = String(formData.get("content") || "").trim();
  if (!content) return;
  const level = formData.get("level") === "warn" ? "warn" : "info";
  const startsAt = String(formData.get("startsAt") || "");
  const endsAt = String(formData.get("endsAt") || "");
  await prisma.announcement.create({
    data: {
      content,
      level,
      active: true,
      startsAt: startsAt ? new Date(startsAt) : null,
      endsAt: endsAt ? new Date(endsAt) : null,
      authorId: user.id,
    },
  });
  revalidatePath("/admin/announcements");
  revalidatePath("/");
}

export async function toggleAnnouncement(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const ann = await prisma.announcement.findUnique({ where: { id } });
  if (!ann) return;
  await prisma.announcement.update({ where: { id }, data: { active: !ann.active } });
  revalidatePath("/admin/announcements");
  revalidatePath("/");
}

export async function deleteAnnouncement(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  await prisma.announcement.delete({ where: { id } });
  revalidatePath("/admin/announcements");
  revalidatePath("/");
}
