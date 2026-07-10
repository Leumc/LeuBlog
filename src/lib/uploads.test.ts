import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  UPLOAD_DIR,
  randomStorageName,
  resolveUploadDirectory,
  resolveUploadPath,
  uploadUrl,
} from "./uploads";

describe("media upload paths", () => {
  it("accepts nested randomized image paths inside uploads", () => {
    const full = resolveUploadPath("a1b2/c3d4/image.webp");
    expect(full).toBe(path.join(UPLOAD_DIR, "a1b2", "c3d4", "image.webp"));
    expect(resolveUploadDirectory("a1b2/c3d4")).toBe(path.join(UPLOAD_DIR, "a1b2", "c3d4"));
  });

  it("rejects traversal, unsupported extensions and unsafe segments", () => {
    expect(resolveUploadPath("../secret.png")).toBeNull();
    expect(resolveUploadPath("folder/file.txt")).toBeNull();
    expect(resolveUploadPath("folder name/file.png")).toBeNull();
    expect(resolveUploadDirectory("a/../../outside")).toBeNull();
  });

  it("generates opaque names and encodes public URLs by segment", () => {
    expect(randomStorageName()).toMatch(/^[a-f0-9]{24}$/);
    expect(uploadUrl("abc/def.png")).toBe("/uploads/abc/def.png");
  });
});
