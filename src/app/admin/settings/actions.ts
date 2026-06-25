"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/permissions";
import { setSetting, SETTING_DEFAULTS, normalizeAccent, isValidHex } from "@/lib/settings";

export async function saveSettings(formData: FormData): Promise<void> {
  await requireAdmin();
  for (const key of Object.keys(SETTING_DEFAULTS)) {
    if (!formData.has(key)) continue;
    let value = String(formData.get(key) || "");
    // 颜色字段校验：非法则回退默认
    if (key === "appearance.accent") value = normalizeAccent(value);
    if (key === "appearance.paper" && !isValidHex(value)) value = SETTING_DEFAULTS["appearance.paper"];
    await setSetting(key, value);
  }
  revalidatePath("/", "layout");
}
