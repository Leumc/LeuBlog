"use client";

import { useEffect } from "react";

export default function ProgressBar() {
  useEffect(() => {
    const el = document.getElementById("progress");
    if (!el) return;
    const onScroll = () => {
      const h = document.documentElement;
      const pct = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100;
      el.style.width = `${isFinite(pct) ? pct : 0}%`;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return <div id="progress" />;
}
