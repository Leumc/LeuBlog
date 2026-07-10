import { describe, expect, it } from "vitest";
import {
  POST_DRAFT_TTL_MS,
  editorIdentityFromPathname,
  isPostDraftExpired,
  postDraftFieldsEqual,
  postDraftStorageKey,
  readPostDraft,
  shouldConfirmEditorNavigation,
  type PostDraftFields,
} from "./post-browser-draft";

const fields: PostDraftFields = {
  title: "标题",
  slug: "slug",
  excerpt: "摘要",
  content: "正文",
  categoryId: "category",
  tagIds: ["b", "a"],
  locked: true,
  gateNote: "说明",
  keyIds: ["2", "1"],
};

describe("post browser drafts", () => {
  it("expires drafts after 24 hours", () => {
    expect(isPostDraftExpired(1_000, 1_000 + POST_DRAFT_TTL_MS - 1)).toBe(false);
    expect(isPostDraftExpired(1_000, 1_000 + POST_DRAFT_TTL_MS)).toBe(true);
  });

  it("compares all editor fields while ignoring selection order", () => {
    expect(postDraftFieldsEqual(fields, { ...fields, tagIds: ["a", "b"], keyIds: ["1", "2"] })).toBe(true);
    expect(postDraftFieldsEqual(fields, { ...fields, content: "修改" })).toBe(false);
  });

  it("recognizes new and existing editor routes", () => {
    expect(editorIdentityFromPathname("/admin/posts/new")).toBe("new");
    expect(editorIdentityFromPathname("/admin/posts/post-id/edit")).toBe("post-id");
    expect(editorIdentityFromPathname("/admin/media")).toBeNull();
  });

  it("guards destructive editor switches but allows returning to the same draft", () => {
    expect(shouldConfirmEditorNavigation({ activeIdentity: "a", targetIdentity: "a", currentEditorIdentity: null })).toBe(false);
    expect(shouldConfirmEditorNavigation({ activeIdentity: "a", targetIdentity: "b", currentEditorIdentity: null })).toBe(true);
    expect(shouldConfirmEditorNavigation({ activeIdentity: "new", targetIdentity: "new", currentEditorIdentity: "new" })).toBe(true);
    expect(shouldConfirmEditorNavigation({ activeIdentity: null, targetIdentity: "new", currentEditorIdentity: null })).toBe(false);
  });

  it("reads valid drafts and removes expired drafts", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => { values.delete(key); },
    };
    const key = postDraftStorageKey("user", "new");
    values.set(key, JSON.stringify({
      version: 1,
      ownerId: "user",
      identity: "new",
      baseUpdatedAt: null,
      savedAt: 1_000,
      fields,
    }));

    expect(readPostDraft(storage, "user", "new", 2_000)?.fields.title).toBe("标题");
    expect(readPostDraft(storage, "user", "new", 1_000 + POST_DRAFT_TTL_MS)).toBeNull();
    expect(values.has(key)).toBe(false);
  });
});
