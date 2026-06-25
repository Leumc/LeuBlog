"use server";

import { unlink } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/permissions";
import { UPLOAD_DIR } from "@/lib/uploads";

export async function deleteMedia(formData: FormData): Promise<void> {
  await requireAdmin();
  const name = String(formData.get("name") || "");
  if (!name || name.includes("/") || name.includes("..")) return;
  const full = path.join(UPLOAD_DIR, name);
  if (!full.startsWith(UPLOAD_DIR)) return;
  try {
    await unlink(full);
  } catch {
    /* ignore */
  }
  revalidatePath("/admin/media");
}
