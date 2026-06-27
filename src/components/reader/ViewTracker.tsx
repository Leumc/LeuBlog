"use client";

import { useEffect } from "react";

/** 同一 slug 上次计数后 5 分钟内再次进入不重复计数 */
const DEDUP_WINDOW_MS = 5 * 60 * 1000;

/** 文章页打点：进入文章计一次；退出后 5 分钟内再进不计，超过则再计 */
export default function ViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `viewed:${slug}`;
    let last = 0;
    try {
      last = Number(localStorage.getItem(key)) || 0;
    } catch {
      /* 隐私模式等无 localStorage，按未计数处理 */
    }
    const now = Date.now();
    if (now - last < DEDUP_WINDOW_MS) return; // 5 分钟内重复进入，不计

    try {
      localStorage.setItem(key, String(now));
    } catch {
      /* 忽略存储失败 */
    }
    fetch("/api/view", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug }),
      keepalive: true,
    }).catch(() => {});
  }, [slug]);
  return null;
}
