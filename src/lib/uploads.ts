import "server-only";
import path from "node:path";
import { readdir, stat } from "node:fs/promises";
import { randomBytes } from "node:crypto";

/** 上传根目录（与 Docker 挂载卷一致：<项目根>/uploads） */
export const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const IMAGE_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
};

const FILE_MIME: Record<string, string> = {
  ...IMAGE_MIME,
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".json": "application/json",
  ".xml": "application/xml",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".odt": "application/vnd.oasis.opendocument.text",
  ".ods": "application/vnd.oasis.opendocument.spreadsheet",
  ".odp": "application/vnd.oasis.opendocument.presentation",
  ".epub": "application/epub+zip",
  ".zip": "application/zip",
  ".7z": "application/x-7z-compressed",
  ".rar": "application/vnd.rar",
  ".tar": "application/x-tar",
  ".gz": "application/gzip",
  ".tgz": "application/gzip",
  ".bz2": "application/x-bzip2",
  ".xz": "application/x-xz",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".c": "text/plain; charset=utf-8",
  ".h": "text/plain; charset=utf-8",
  ".cpp": "text/plain; charset=utf-8",
  ".hpp": "text/plain; charset=utf-8",
  ".go": "text/plain; charset=utf-8",
  ".java": "text/plain; charset=utf-8",
  ".py": "text/plain; charset=utf-8",
  ".rs": "text/plain; charset=utf-8",
  ".sh": "text/plain; charset=utf-8",
  ".sql": "text/plain; charset=utf-8",
  ".yaml": "text/plain; charset=utf-8",
  ".yml": "text/plain; charset=utf-8",
};

export const MAX_IMAGE_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_FILE_UPLOAD_BYTES = 64 * 1024 * 1024;

export function contentTypeFor(filename: string): string {
  return FILE_MIME[path.extname(filename).toLowerCase()] || "application/octet-stream";
}

export function allowedExt(filename: string): boolean {
  return path.extname(filename).toLowerCase() in FILE_MIME;
}

export function isImageFile(filename: string): boolean {
  return path.extname(filename).toLowerCase() in IMAGE_MIME;
}

export function maxUploadBytes(filename: string): number {
  return isImageFile(filename) ? MAX_IMAGE_UPLOAD_BYTES : MAX_FILE_UPLOAD_BYTES;
}

export function randomStorageName(bytes = 12): string {
  return randomBytes(bytes).toString("hex");
}

export function randomStorageFilename(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  if (!(ext in FILE_MIME)) throw new Error("不支持的文件类型");
  return `${randomStorageName(16)}${ext}`;
}

/** 校验并解析 uploads 下的相对媒体路径，拒绝穿越与不支持的文件。 */
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

export function downloadUrl(assetId: string): string {
  return `/downloads/${encodeURIComponent(assetId)}`;
}

export function downloadContentDisposition(displayName: string): string {
  const safeName = displayName.replace(/[\\/\x00-\x1f\x7f]/g, "_").trim() || "download";
  const fallback = safeName
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(safeName).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
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
