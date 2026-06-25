"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";

function revalidate() {
  revalidatePath("/admin/portals");
  revalidatePath("/");
}

export async function createPortal(formData: FormData): Promise<void> {
  await requireAdmin();
  const title = String(formData.get("title") || "").trim();
  const url = String(formData.get("url") || "").trim();
  if (!title || !url) return;
  await prisma.portal.create({
    data: {
      title,
      url,
      description: String(formData.get("description") || "").trim() || null,
      group: String(formData.get("group") || "友链").trim() || "友链",
      placement: formData.get("placement") === "footer" ? "footer" : "sidebar",
      order: parseInt(String(formData.get("order") || "0"), 10) || 0,
    },
  });
  revalidate();
}

export async function togglePortal(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const p = await prisma.portal.findUnique({ where: { id } });
  if (!p) return;
  await prisma.portal.update({ where: { id }, data: { visible: !p.visible } });
  revalidate();
}

export async function deletePortal(formData: FormData): Promise<void> {
  await requireAdmin();
  await prisma.portal.delete({ where: { id: String(formData.get("id") || "") } });
  revalidate();
}
