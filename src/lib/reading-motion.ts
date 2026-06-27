/** 阅读动效模式：浮入 / 打字机 / 关闭。读者端选择，存 localStorage。 */
export type ReadingMotion = "reveal" | "typewriter" | "off";

export const READING_MOTION_KEY = "reading-motion";
export const READING_MOTION_EVENT = "reading-motion";
export const DEFAULT_READING_MOTION: ReadingMotion = "reveal";

const VALID: ReadingMotion[] = ["reveal", "typewriter", "off"];

function isReadingMotion(v: unknown): v is ReadingMotion {
  return typeof v === "string" && (VALID as string[]).includes(v);
}

/** 从 localStorage 读取当前模式，无效或缺失时回落到默认值。SSR 安全。 */
export function readReadingMotion(): ReadingMotion {
  if (typeof window === "undefined") return DEFAULT_READING_MOTION;
  try {
    const v = window.localStorage.getItem(READING_MOTION_KEY);
    return isReadingMotion(v) ? v : DEFAULT_READING_MOTION;
  } catch {
    return DEFAULT_READING_MOTION;
  }
}

/** 写入模式并广播 reading-motion 事件，供正文实时切换。 */
export function setReadingMotion(mode: ReadingMotion): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(READING_MOTION_KEY, mode);
  } catch {
    /* 忽略存储失败（隐私模式等），仍派发事件 */
  }
  window.dispatchEvent(
    new CustomEvent<ReadingMotion>(READING_MOTION_EVENT, { detail: mode }),
  );
}
