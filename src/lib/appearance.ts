/** 强调色预设与校验（无副作用，服务端/客户端共用，勿加 server-only） */

export const ACCENT_PRESETS = [
  { name: "砖红", value: "#9c2b22" },
  { name: "墨绿", value: "#1f8a4c" },
  { name: "靛蓝", value: "#2563a8" },
] as const;

export const DEFAULT_ACCENT = "#9c2b22";
export const DEFAULT_PAPER = "#faf7f1";

export function isValidHex(s: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s.trim());
}

/** 规范化强调色：合法则返回小写，否则回退默认砖红 */
export function normalizeAccent(s: string | undefined): string {
  if (s && isValidHex(s)) return s.trim().toLowerCase();
  return DEFAULT_ACCENT;
}
