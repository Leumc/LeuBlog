"use client";

import { useState } from "react";

export default function CopyLink({ url }: { url: string }) {
  const [done, setDone] = useState(false);
  return (
    <span
      className="lk"
      onClick={() => {
        navigator.clipboard?.writeText(url).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        });
      }}
    >
      {done ? "已复制" : "复制"}
    </span>
  );
}
