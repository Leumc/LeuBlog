"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function MediaUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", f);
        await fetch("/api/upload", { method: "POST", body: fd });
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="drop"
      style={drag ? { borderColor: "var(--aaccent)", background: "#fbeceb" } : undefined}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        upload(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
    >
      {busy ? "上传中…" : "把图片拖到这里上传，或 "}
      {!busy && <span className="lk">点击选择文件</span>}
      （支持 JPG / PNG / WebP / GIF / SVG，单张 ≤ 8 MB）
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => upload(e.target.files)}
      />
    </div>
  );
}
