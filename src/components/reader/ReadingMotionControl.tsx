"use client";

import { useEffect, useState } from "react";
import {
  type ReadingMotion,
  DEFAULT_READING_MOTION,
  READING_MOTION_EVENT,
  readReadingMotion,
  setReadingMotion,
} from "@/lib/reading-motion";

const OPTIONS: { value: ReadingMotion; label: string }[] = [
  { value: "reveal", label: "浮入" },
  { value: "typewriter", label: "打字机" },
  { value: "off", label: "关闭" },
];

/** 顶部导航上的阅读动效切换器（首页与文章页均显示）。 */
export default function ReadingMotionControl() {
  // SSR 先渲染默认态，挂载后同步 localStorage，避免 hydration mismatch
  const [mode, setMode] = useState<ReadingMotion>(DEFAULT_READING_MOTION);

  useEffect(() => {
    setMode(readReadingMotion());
    // 跨标签页 / 其它来源的变更也同步高亮
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<ReadingMotion>).detail;
      if (detail) setMode(detail);
    };
    window.addEventListener(READING_MOTION_EVENT, onChange);
    return () => window.removeEventListener(READING_MOTION_EVENT, onChange);
  }, []);

  const choose = (m: ReadingMotion) => {
    setMode(m);
    setReadingMotion(m);
  };

  return (
    <div className="rm-control" role="group" aria-label="阅读动效">
      <div className="k">阅读动效</div>
      <div className="opts">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            className={o.value === mode ? "active" : ""}
            aria-pressed={o.value === mode}
            onClick={() => choose(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
