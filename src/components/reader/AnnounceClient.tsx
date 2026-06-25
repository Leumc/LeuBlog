"use client";

import { useState } from "react";

export default function AnnounceClient({
  content,
  level,
}: {
  content: string;
  level: "info" | "warn";
}) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <div className={`announce${level === "warn" ? " warn" : ""}`}>
      <div className="wrap">
        <span className="tag">{level === "warn" ? "注意" : "公告"}</span>
        <span className="txt">{content}</span>
        <button className="x" aria-label="关闭公告" onClick={() => setHidden(true)}>
          ×
        </button>
      </div>
    </div>
  );
}
