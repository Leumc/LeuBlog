/** 通用工具（可用于服务端/客户端，勿引入 server-only 依赖） */

/** 标题转 slug：仅保留 ASCII 字母数字与连字符，确保可作为 URL 路径段。
 *  中文等非 ASCII 字符不保留（避免 URL 编码导致路由 404/400）；
 *  结果为空时回退到 post-<随机>。 */
export function slugify(input: string): string {
  const s = input
    .trim()
    .toLowerCase()
    .replace(/[\s]+/g, "-")
    // 先把非 ASCII 字母（含中文）与标点整体丢弃
    .replace(/[^a-z0-9\-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s || "post-" + Math.random().toString(36).slice(2, 8);
}

export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

export function formatDateShort(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/** "06 / 22" 样式 */
export function formatDateSlash(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${String(date.getMonth() + 1).padStart(2, "0")} / ${String(date.getDate()).padStart(2, "0")}`;
}

/** 千分位阅读数 */
export function formatViews(n: number): string {
  return n.toLocaleString("en-US");
}

/** 紧凑数字：1.5k */
export function formatCompact(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

export function dateKey(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}
