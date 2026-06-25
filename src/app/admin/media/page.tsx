import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR, allowedExt } from "@/lib/uploads";
import { deleteMedia } from "./actions";
import MediaUploader from "./MediaUploader";
import CopyLink from "./CopyLink";

export const dynamic = "force-dynamic";

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + " MB";
  return Math.max(1, Math.round(bytes / 1024)) + " KB";
}

export default async function MediaPage() {
  let files: { name: string; size: number; mtime: number }[] = [];
  try {
    const names = (await readdir(UPLOAD_DIR)).filter(allowedExt);
    files = await Promise.all(
      names.map(async (n) => {
        const s = await stat(path.join(UPLOAD_DIR, n));
        return { name: n, size: s.size, mtime: s.mtimeMs };
      }),
    ).then((arr) => arr.sort((a, b) => b.mtime - a.mtime));
  } catch {
    files = [];
  }
  const totalMB = files.reduce((a, f) => a + f.size, 0) / 1024 / 1024;

  return (
    <div className="panel">
      <div className="h">
        <h2>媒体库</h2>
        <span className="right" style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--soft)" }}>
          已用 {totalMB.toFixed(1)} MB · 共 {files.length} 个文件
        </span>
      </div>
      <div className="b">
        <MediaUploader />
        {files.length === 0 ? (
          <p style={{ marginTop: 18, color: "var(--amuted)", fontSize: 13, textAlign: "center" }}>
            还没有上传任何图片。
          </p>
        ) : (
          <div className="media" style={{ marginTop: 16 }}>
            {files.map((f) => (
              <div className="m" key={f.name}>
                <div className="ph">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/uploads/${f.name}`} alt={f.name} />
                </div>
                <div className="mi">
                  <div className="nm" title={f.name}>
                    {f.name}
                  </div>
                  <div className="sz">
                    <span>{fmtSize(f.size)}</span>
                    <span style={{ display: "flex", gap: 8 }}>
                      <CopyLink url={`/uploads/${f.name}`} />
                      <form action={deleteMedia}>
                        <input type="hidden" name="name" value={f.name} />
                        <button className="lk del">删除</button>
                      </form>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
