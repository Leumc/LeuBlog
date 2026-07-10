import "server-only";
import path from "node:path";
import { readdir, stat } from "node:fs/promises";
import { randomBytes } from "node:crypto";

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

export function randomStorageName(bytes = 12): string {
  return randomBytes(bytes).toString("hex");
}

/** 校验并解析 uploads 下的相对图片路径，拒绝穿越与非图片文件。 */
export function resolveUploadPath(relativePath: string): string | null {
  const normalized = relativePath.replaceAll("\\", "/").replace(/^\/+/, "");
  const segments = normalized.split("/");
  if (
    !normalized ||
    !allowedExt(normalized) ||
    segments.some((segment) => !segment || segment === "." || segment === ".." || !/^[\w.-]+$/.test(segment))
  ) return null;
  const full = path.resolve(UPLOAD_DIR, ...segments);
  const root = path.resolve(UPLOAD_DIR) + path.sep;
  return full.startsWith(root) ? full : null;
}

export function uploadUrl(relativePath: string): string {
  return `/uploads/${relativePath.split("/").map(encodeURIComponent).join("/")}`;
}

export type DiskMediaFile = { relativePath: string; filename: string; size: number; mtime: number };

export async function walkUploadFiles(relativeDir = ""): Promise<DiskMediaFile[]> {
  const fullDir = relativeDir ? resolveUploadDirectory(relativeDir) : UPLOAD_DIR;
  if (!fullDir) return [];
  let entries;
  try {
    entries = await readdir(fullDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const nested = await Promise.all(entries.map(async (entry) => {
    if (!/^[\w.-]+$/.test(entry.name) || entry.name === "." || entry.name === "..") return [];
    const rel = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return walkUploadFiles(rel);
    if (!entry.isFile() || !allowedExt(entry.name)) return [];
    const info = await stat(path.join(fullDir, entry.name));
    return [{ relativePath: rel, filename: entry.name, size: info.size, mtime: info.mtimeMs }];
  }));
  return nested.flat();
}

export function resolveUploadDirectory(relativeDir: string): string | null {
  const normalized = relativeDir.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
  if (!normalized) return UPLOAD_DIR;
  const segments = normalized.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === ".." || !/^[\w.-]+$/.test(segment))) return null;
  const full = path.resolve(UPLOAD_DIR, ...segments);
  const root = path.resolve(UPLOAD_DIR) + path.sep;
  return full.startsWith(root) ? full : null;
}
