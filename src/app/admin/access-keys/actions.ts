"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { encryptSecret } from "@/lib/access-keys";

function parsePostIds(fd: FormData): string[] {
  return fd.getAll("postIds").map(String).filter(Boolean);
}

function parseMaxUses(v: FormDataEntryValue | null): number | null {
  const s = String(v || "").trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseValidUntil(v: FormDataEntryValue | null): Date | null {
  const s = String(v || "").trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export async function createAccessKey(formData: FormData): Promise<void> {
  await requireAdmin();
  const secret = String(formData.get("secret") || "").trim();
  if (!secret) return;
  await prisma.accessKey.create({
    data: {
      label: String(formData.get("label") || "").trim() || null,
      secretEnc: encryptSecret(secret),
      note: String(formData.get("note") || "").trim() || null,
      maxUses: parseMaxUses(formData.get("maxUses")),
      validUntil: parseValidUntil(formData.get("validUntil")),
      active: formData.get("active") === "on",
      posts: { connect: parsePostIds(formData).map((id) => ({ id })) },
    },
  });
  revalidatePath("/admin/access-keys");
  redirect("/admin/access-keys");
}

export async function updateAccessKey(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;
  const secret = String(formData.get("secret") || "").trim();
  await prisma.accessKey.update({
    where: { id },
    data: {
      label: String(formData.get("label") || "").trim() || null,
      ...(secret ? { secretEnc: encryptSecret(secret) } : {}),
      note: String(formData.get("note") || "").trim() || null,
      maxUses: parseMaxUses(formData.get("maxUses")),
      validUntil: parseValidUntil(formData.get("validUntil")),
      active: formData.get("active") === "on",
      posts: { set: parsePostIds(formData).map((id) => ({ id })) },
    },
  });
  revalidatePath("/admin/access-keys");
  redirect("/admin/access-keys");
}

export async function deleteAccessKey(formData: FormData): Promise<void> {
  await requireAdmin();
  await prisma.accessKey.delete({ where: { id: String(formData.get("id") || "") } });
  revalidatePath("/admin/access-keys");
}

export async function resetUsage(formData: FormData): Promise<void> {
  await requireAdmin();
  await prisma.accessKey.update({
    where: { id: String(formData.get("id") || "") },
    data: { usedCount: 0 },
  });
  revalidatePath("/admin/access-keys");
}
