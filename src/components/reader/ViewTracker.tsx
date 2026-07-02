"use client";

import { useEffect } from "react";

/** 同一 slug 上次计数后 5 小时内再次进入不重复计数 */
const DEDUP_WINDOW_MS = 5 * 60 * 60 * 1000;

/** 文章页打点：进入文章计一次；退出后 5 小时内再进不计，超过则再计。
 *  后台预览链接带 ?preview=1，整段跳过（不打点、不写去重时间戳）——
 *  管理员随后正常访问该文仍按正常逻辑计数。 */
export default function ViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("preview") === "1") return; // 后台预览：不计数

    const key = `viewed:${slug}`;
    let last = 0;
    try {
      last = Number(localStorage.getItem(key)) || 0;
    } catch {
      /* 隐私模式等无 localStorage，按未计数处理 */
    }
    const now = Date.now();
    if (now - last < DEDUP_WINDOW_MS) return; // 5 小时内重复进入，不计

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
