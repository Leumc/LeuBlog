import "server-only";
import path from "node:path";

/** 上传根目录（与 Docker 挂载卷一致：<项目根>/uploads） */
export const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

export function contentTypeFor(filename: string): string {
  return MIME[path.extname(filename).toLowerCase()] || "application/octet-stream";
}

export function allowedExt(filename: string): boolean {
  return path.extname(filename).toLowerCase() in MIME;
}
