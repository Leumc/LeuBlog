import "server-only";
import { prisma } from "@/lib/prisma";
import {
  ACCENT_PRESETS,
  DEFAULT_ACCENT,
  DEFAULT_PAPER,
  isValidHex,
  normalizeAccent,
} from "@/lib/appearance";

export { ACCENT_PRESETS, isValidHex, normalizeAccent };

/** 站点设置默认值（后台「设置」可覆盖） */
export const SETTING_DEFAULTS = {
  "site.name": "LeuBlog",
  "site.subtitle": "算法学习记录 与 计算机技术教程",
  "masthead.kicker": "Algorithms · Computer Science · Notes",
  "masthead.title": "LeuBlog",
  "masthead.subtitle": "算法学习记录 与 计算机技术教程",
  "home.postCount": "8",
  "portal.placement": "sidebar", // sidebar | footer
  "appearance.accent": DEFAULT_ACCENT,
  "appearance.paper": DEFAULT_PAPER,
  "about.content":
    "# 关于本站\n\n这里记录我的算法学习与计算机技术笔记。内容可在后台「设置」中修改。",
  "about.contact": "邮箱：admin@leublog.local",
  "about.colophon": "由 Next.js + SQLite 构建，部署于轻量 VPS。",
  "footer.poweredBy": "由 Next.js 与衬线字体驱动",
  // 管理员显示名：文章作者为管理员时显示「<该名称>（管理员）」；留空则回退到作者自身 displayName
  "author.adminName": "",
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

/** 读取全部设置（合并默认值） */
export async function getSettings(): Promise<Record<string, string>> {
  const rows = await prisma.siteSetting.findMany();
  const map: Record<string, string> = { ...SETTING_DEFAULTS };
  for (const r of rows) map[r.key] = r.value;
  return map;
}

export async function getSetting(key: SettingKey): Promise<string> {
  const row = await prisma.siteSetting.findUnique({ where: { key } });
  return row?.value ?? SETTING_DEFAULTS[key];
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}
