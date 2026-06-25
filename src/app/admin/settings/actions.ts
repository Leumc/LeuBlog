"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/permissions";
import { setSetting, SETTING_DEFAULTS } from "@/lib/settings";

export async function saveSettings(formData: FormData): Promise<void> {
  await requireAdmin();
  for (const key of Object.keys(SETTING_DEFAULTS)) {
    if (formData.has(key)) {
      await setSetting(key, String(formData.get(key) || ""));
    }
  }
  revalidatePath("/", "layout");
}
