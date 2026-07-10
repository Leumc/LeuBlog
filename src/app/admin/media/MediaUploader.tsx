"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function MediaUploader({ categoryId }: { categoryId?: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const failures: string[] = [];
      for (const f of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", f);
        if (categoryId) fd.append("categoryId", categoryId);
        try {
          const response = await fetch("/api/upload", { method: "POST", body: fd });
          const data = await response.json();
          if (!response.ok || !data.ok) failures.push(`${f.name}：${data.error || "上传失败"}`);
        } catch {
          failures.push(`${f.name}：网络错误`);
        }
      }
      if (failures.length) setError(failures.join("；"));
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
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
    {error && <p className="media-upload-error" role="alert">{error}</p>}
    </div>
  );
}
