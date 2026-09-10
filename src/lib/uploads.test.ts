import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  MAX_FILE_UPLOAD_BYTES,
  MAX_IMAGE_UPLOAD_BYTES,
  UPLOAD_DIR,
  allowedExt,
  contentTypeFor,
  downloadContentDisposition,
  downloadUrl,
  isImageFile,
  maxUploadBytes,
  randomStorageName,
  randomStorageFilename,
  resolveUploadDirectory,
  resolveUploadPath,
  uploadUrl,
} from "./uploads";

describe("media upload paths", () => {
  it("accepts nested randomized media paths inside uploads", () => {
    const full = resolveUploadPath("a1b2/c3d4/image.webp");
    expect(full).toBe(path.join(UPLOAD_DIR, "a1b2", "c3d4", "image.webp"));
    expect(resolveUploadPath("a1b2/c3d4/attachment.pdf")).toBe(
      path.join(UPLOAD_DIR, "a1b2", "c3d4", "attachment.pdf"),
    );
    expect(resolveUploadDirectory("a1b2/c3d4")).toBe(path.join(UPLOAD_DIR, "a1b2", "c3d4"));
  });

  it("rejects traversal, unsupported extensions and unsafe segments", () => {
    expect(resolveUploadPath("../secret.png")).toBeNull();
    expect(resolveUploadPath("folder/file.exe")).toBeNull();
    expect(resolveUploadPath("folder name/file.png")).toBeNull();
    expect(resolveUploadDirectory("a/../../outside")).toBeNull();
  });

  it("generates opaque names and encodes public URLs by segment", () => {
    expect(randomStorageName()).toMatch(/^[a-f0-9]{24}$/);
    expect(randomStorageFilename("课程资料.PDF")).toMatch(/^[a-f0-9]{32}\.pdf$/);
    expect(uploadUrl("abc/def.png")).toBe("/uploads/abc/def.png");
    expect(downloadUrl("asset_123")).toBe("/downloads/asset_123");
  });

  it("distinguishes images from downloadable files and applies separate size limits", () => {
    expect(allowedExt("notes.pdf")).toBe(true);
    expect(allowedExt("source.cpp")).toBe(true);
    expect(allowedExt("malware.exe")).toBe(false);
    expect(isImageFile("photo.avif")).toBe(true);
    expect(isImageFile("notes.pdf")).toBe(false);
    expect(maxUploadBytes("photo.png")).toBe(MAX_IMAGE_UPLOAD_BYTES);
    expect(maxUploadBytes("archive.zip")).toBe(MAX_FILE_UPLOAD_BYTES);
    expect(contentTypeFor("report.xlsx")).toContain("spreadsheetml");
  });

  it("uses the display name as an RFC 5987 download filename", () => {
    const header = downloadContentDisposition("课程资料（第一讲）.pdf");
    expect(header).toContain("attachment;");
    expect(header).toContain("filename*=UTF-8''%E8%AF%BE%E7%A8%8B");
    expect(downloadContentDisposition("../bad\r\nname.zip")).not.toMatch(/[\r\n]/);
    expect(downloadContentDisposition("bad\u0000name.zip")).not.toContain("\u0000");
  });
});
