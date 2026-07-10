export const POST_DRAFT_VERSION = 1 as const;
export const POST_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
export const POST_DRAFT_EVENT = "leublog:post-draft-change";
export const POST_DRAFT_FLUSH_EVENT = "leublog:post-draft-flush";
export const POST_DRAFT_DISCARD_EVENT = "leublog:post-draft-discard";

export type PostDraftFields = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  categoryId: string;
  tagIds: string[];
  locked: boolean;
  gateNote: string;
  keyIds: string[];
};

export type PostBrowserDraft = {
  version: typeof POST_DRAFT_VERSION;
  ownerId: string;
  identity: string;
  baseUpdatedAt: string | null;
  savedAt: number;
  fields: PostDraftFields;
};

export type ActivePostDraft = {
  version: typeof POST_DRAFT_VERSION;
  ownerId: string;
  identity: string;
  draftKey: string;
  route: string;
  title: string;
  savedAt: number;
};

export function postDraftIdentity(postId?: string): string {
  return postId || "new";
}

export function postDraftStorageKey(ownerId: string, identity: string): string {
  return `leublog:post-draft:v1:${ownerId}:${identity}`;
}

export function activePostDraftStorageKey(ownerId: string): string {
  return `leublog:post-draft-active:v1:${ownerId}`;
}

export function postEditorRoute(identity: string): string {
  return identity === "new" ? "/admin/posts/new" : `/admin/posts/${identity}/edit`;
}

export function editorIdentityFromPathname(pathname: string): string | null {
  if (pathname === "/admin/posts/new") return "new";
  const match = pathname.match(/^\/admin\/posts\/([^/]+)\/edit\/?$/);
  return match?.[1] ?? null;
}

export function isPostDraftExpired(savedAt: number, now = Date.now()): boolean {
  return !Number.isFinite(savedAt) || now - savedAt >= POST_DRAFT_TTL_MS;
}

function isDraftShape(value: unknown): value is PostBrowserDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<PostBrowserDraft>;
  const fields = draft.fields as Partial<PostDraftFields> | undefined;
  return draft.version === POST_DRAFT_VERSION &&
    typeof draft.ownerId === "string" &&
    typeof draft.identity === "string" &&
    typeof draft.savedAt === "number" &&
    (draft.baseUpdatedAt === null || typeof draft.baseUpdatedAt === "string") &&
    !!fields &&
    typeof fields.title === "string" &&
    typeof fields.slug === "string" &&
    typeof fields.excerpt === "string" &&
    typeof fields.content === "string" &&
    typeof fields.categoryId === "string" &&
    Array.isArray(fields.tagIds) && fields.tagIds.every((id) => typeof id === "string") &&
    typeof fields.locked === "boolean" &&
    typeof fields.gateNote === "string" &&
    Array.isArray(fields.keyIds) && fields.keyIds.every((id) => typeof id === "string");
}

function isActiveShape(value: unknown): value is ActivePostDraft {
  if (!value || typeof value !== "object") return false;
  const active = value as Partial<ActivePostDraft>;
  return active.version === POST_DRAFT_VERSION &&
    typeof active.ownerId === "string" &&
    typeof active.identity === "string" &&
    typeof active.draftKey === "string" &&
    typeof active.route === "string" &&
    typeof active.savedAt === "number";
}

export function readPostDraft(
  storage: Pick<Storage, "getItem" | "removeItem">,
  ownerId: string,
  identity: string,
  now = Date.now(),
): PostBrowserDraft | null {
  const key = postDraftStorageKey(ownerId, identity);
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!isDraftShape(value) || value.ownerId !== ownerId || value.identity !== identity || isPostDraftExpired(value.savedAt, now)) {
      storage.removeItem(key);
      return null;
    }
    return value;
  } catch {
    try { storage.removeItem(key); } catch { /* unavailable storage */ }
    return null;
  }
}

export function readActivePostDraft(
  storage: Pick<Storage, "getItem" | "removeItem">,
  ownerId: string,
  now = Date.now(),
): ActivePostDraft | null {
  const key = activePostDraftStorageKey(ownerId);
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!isActiveShape(value) || value.ownerId !== ownerId || isPostDraftExpired(value.savedAt, now)) {
      storage.removeItem(key);
      if (isActiveShape(value)) storage.removeItem(value.draftKey);
      return null;
    }
    if (!storage.getItem(value.draftKey)) {
      storage.removeItem(key);
      return null;
    }
    return value;
  } catch {
    try { storage.removeItem(key); } catch { /* unavailable storage */ }
    return null;
  }
}

export function normalizedPostDraftFields(fields: PostDraftFields): PostDraftFields {
  return {
    ...fields,
    tagIds: [...fields.tagIds].sort(),
    keyIds: [...fields.keyIds].sort(),
  };
}

export function postDraftFieldsEqual(a: PostDraftFields, b: PostDraftFields): boolean {
  return JSON.stringify(normalizedPostDraftFields(a)) === JSON.stringify(normalizedPostDraftFields(b));
}

export function shouldConfirmEditorNavigation({
  activeIdentity,
  targetIdentity,
  currentEditorIdentity,
}: {
  activeIdentity: string | null;
  targetIdentity: string;
  currentEditorIdentity: string | null;
}): boolean {
  if (!activeIdentity) return false;
  if (currentEditorIdentity === "new" && targetIdentity === "new") return true;
  return targetIdentity !== activeIdentity;
}
