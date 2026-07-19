"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { savePostAsDraft, publishPost, resetViews } from "@/app/admin/posts/post-actions";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { formatViews } from "@/lib/utils";
import {
  POST_DRAFT_EVENT,
  POST_DRAFT_DISCARD_EVENT,
  POST_DRAFT_FLUSH_EVENT,
  activePostDraftStorageKey,
  postDraftFieldsEqual,
  postDraftIdentity,
  postDraftStorageKey,
  postEditorRoute,
  readActivePostDraft,
  readPostDraft,
  type PostBrowserDraft,
  type PostDraftFields,
} from "@/lib/post-browser-draft";

const MarkdownEditor = dynamic(() => import("./MarkdownEditor"), { ssr: false });

type MarkdownEditorView = {
  state: {
    selection: { main: { from: number; to: number } };
    sliceDoc: (from: number, to: number) => string;
  };
  dispatch: (spec: {
    changes: { from: number; to: number; insert: string };
    selection: { anchor: number };
  }) => void;
  focus: () => void;
};

export type EditorPost = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  status: "DRAFT" | "PUBLISHED";
  categoryId: string | null;
  tagIds: string[];
  locked: boolean;
  gateNote: string;
  keyIds: string[];
  viewCount?: number;
  updatedAt: string | null;
};

export type Taxonomy = {
  id: string;
  name: string;
  tagGroups: { id: string; name: string; tags: { id: string; name: string }[] }[];
}[];

export default function PostEditor({
  post,
  ownerId,
  categories,
  taxonomy,
  canLock,
  canReset,
  allKeys,
}: {
  post: EditorPost;
  ownerId: string;
  categories: { id: string; name: string }[];
  taxonomy: Taxonomy;
  canLock: boolean;
  canReset: boolean;
  allKeys: {
    id: string;
    label: string;
    active: boolean;
    usedCount: number;
    maxUses: number | null;
    validUntil: string | null;
  }[];
}) {
  const router = useRouter();
  const identity = postDraftIdentity(post.id);
  const draftKey = postDraftStorageKey(ownerId, identity);
  const initialFieldsRef = useRef<PostDraftFields>({
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content,
    categoryId: post.categoryId ?? "",
    tagIds: post.tagIds,
    locked: post.locked,
    gateNote: post.gateNote,
    keyIds: post.keyIds,
  });
  const [title, setTitle] = useState(post.title);
  const [slug, setSlug] = useState(post.slug);
  const [excerpt, setExcerpt] = useState(post.excerpt);
  const [content, setContent] = useState(post.content);
  const [categoryId, setCategoryId] = useState(post.categoryId ?? "");
  const [tagIds, setTagIds] = useState<string[]>(post.tagIds);
  const [keyIds, setKeyIds] = useState<string[]>(post.keyIds);
  const [locked, setLocked] = useState(post.locked);
  const [gateNote, setGateNote] = useState(post.gateNote);
  const [previewHtml, setPreviewHtml] = useState("");
  const [uploading, setUploading] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [browserDraftStatus, setBrowserDraftStatus] = useState("");
  const [saveError, setSaveError] = useState("");
  const [restored, setRestored] = useState(false);
  const [conflictingDraft, setConflictingDraft] = useState<PostBrowserDraft | null>(null);
  const [saving, startSaving] = useTransition();
  const resetFormRef = useRef<HTMLFormElement>(null);
  const viewRef = useRef<MarkdownEditorView | null>(null);
  const draftEnabledRef = useRef(true);
  const restoredRef = useRef(false);
  const handleContentChange = useCallback((value: string) => {
    setContent(value);
  }, []);

  const currentFields = useMemo<PostDraftFields>(() => ({
    title,
    slug,
    excerpt,
    content,
    categoryId,
    tagIds,
    locked,
    gateNote,
    keyIds,
  }), [title, slug, excerpt, content, categoryId, tagIds, locked, gateNote, keyIds]);
  const currentFieldsRef = useRef(currentFields);
  currentFieldsRef.current = currentFields;
  const dirty = !postDraftFieldsEqual(currentFields, initialFieldsRef.current);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  const clearBrowserDraft = useCallback(() => {
    try {
      window.localStorage.removeItem(draftKey);
      const active = readActivePostDraft(window.localStorage, ownerId);
      if (active?.draftKey === draftKey) {
        window.localStorage.removeItem(activePostDraftStorageKey(ownerId));
      }
      window.dispatchEvent(new Event(POST_DRAFT_EVENT));
    } catch {
      /* storage unavailable */
    }
    setBrowserDraftStatus("");
  }, [draftKey, ownerId]);

  const persistBrowserDraft = useCallback((fields: PostDraftFields) => {
    if (!draftEnabledRef.current) return;
    const savedAt = Date.now();
    try {
      window.localStorage.setItem(draftKey, JSON.stringify({
        version: 1,
        ownerId,
        identity,
        baseUpdatedAt: post.updatedAt,
        savedAt,
        fields,
      } satisfies PostBrowserDraft));
      window.localStorage.setItem(activePostDraftStorageKey(ownerId), JSON.stringify({
        version: 1,
        ownerId,
        identity,
        draftKey,
        route: postEditorRoute(identity),
        title: fields.title.trim() || "未命名文章",
        savedAt,
      }));
      setBrowserDraftStatus(`已保存到浏览器 ${new Date(savedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`);
      window.dispatchEvent(new Event(POST_DRAFT_EVENT));
    } catch {
      setBrowserDraftStatus("浏览器临时保存失败");
    }
  }, [draftKey, identity, ownerId, post.updatedAt]);

  const validCategoryIds = useMemo(() => new Set(categories.map((category) => category.id)), [categories]);
  const validTagIds = useMemo(
    () => new Set(taxonomy.flatMap((category) => category.tagGroups.flatMap((group) => group.tags.map((tag) => tag.id)))),
    [taxonomy],
  );
  const validKeyIds = useMemo(() => new Set(allKeys.map((key) => key.id)), [allKeys]);

  const applyBrowserDraft = useCallback((draft: PostBrowserDraft) => {
    const fields = draft.fields;
    setTitle(fields.title);
    setSlug(fields.slug);
    setExcerpt(fields.excerpt);
    setContent(fields.content);
    setCategoryId(validCategoryIds.has(fields.categoryId) ? fields.categoryId : "");
    setTagIds(fields.tagIds.filter((id) => validTagIds.has(id)));
    setLocked(fields.locked);
    setGateNote(fields.gateNote);
    setKeyIds(fields.keyIds.filter((id) => validKeyIds.has(id)));
    setBrowserDraftStatus(`已恢复浏览器草稿 ${new Date(draft.savedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`);
  }, [validCategoryIds, validKeyIds, validTagIds]);

  useEffect(() => {
    const draft = readPostDraft(window.localStorage, ownerId, identity);
    if (!draft) {
      restoredRef.current = true;
      setRestored(true);
      return;
    }
    if (post.updatedAt && draft.baseUpdatedAt !== post.updatedAt) {
      setConflictingDraft(draft);
      return;
    }
    applyBrowserDraft(draft);
    restoredRef.current = true;
    setRestored(true);
  }, [applyBrowserDraft, identity, ownerId, post.updatedAt]);

  useEffect(() => {
    if (!restored || conflictingDraft) return;
    if (!dirty) {
      clearBrowserDraft();
      return;
    }
    const timer = window.setTimeout(() => persistBrowserDraft(currentFields), 300);
    return () => window.clearTimeout(timer);
  }, [clearBrowserDraft, conflictingDraft, currentFields, dirty, persistBrowserDraft, restored]);

  const persistLatestRef = useRef<() => void>(() => undefined);
  persistLatestRef.current = () => {
    if (!restoredRef.current) return;
    if (dirtyRef.current) persistBrowserDraft(currentFieldsRef.current);
    else clearBrowserDraft();
  };
  useEffect(() => {
    const flush = () => persistLatestRef.current();
    const discard = (event: Event) => {
      const discardedKey = (event as CustomEvent<string | null>).detail;
      if (discardedKey && discardedKey !== draftKey) return;
      draftEnabledRef.current = false;
      restoredRef.current = false;
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener(POST_DRAFT_FLUSH_EVENT, flush);
    window.addEventListener(POST_DRAFT_DISCARD_EVENT, discard);
    document.addEventListener("click", flush, true);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener(POST_DRAFT_FLUSH_EVENT, flush);
      window.removeEventListener(POST_DRAFT_DISCARD_EVENT, discard);
      document.removeEventListener("click", flush, true);
      flush();
    };
  }, [draftKey]);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ markdown: content }),
        });
        const data = await res.json();
        if (data.ok) setPreviewHtml(data.html);
      } catch {
        /* ignore */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [content]);

  const insert = useCallback((text: string, wrap?: string) => {
    const view = viewRef.current;
    if (!view) {
      setContent((c) => c + text);
      return;
    }
    const { from, to } = view.state.selection.main;
    const selected = view.state.sliceDoc(from, to);
    const out = wrap ? `${wrap}${selected || text}${wrap}` : text;
    view.dispatch({
      changes: { from, to, insert: out },
      selection: { anchor: from + out.length },
    });
    view.focus();
  }, []);

  const onUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (data.ok) insert(`\n![${file.name}](${data.url})\n`);
        else alert(data.error || "上传失败");
      } finally {
        setUploading(false);
      }
    },
    [insert],
  );

  const toggleTag = (id: string) =>
    setTagIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));

  const toggleKey = (id: string) =>
    setKeyIds((prev) => (prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]));

  const submitPost = (formData: FormData, intent: "draft" | "publish") => {
    setSaveError("");
    startSaving(async () => {
      try {
        if (intent === "publish") await publishPost(formData);
        else await savePostAsDraft(formData);
        draftEnabledRef.current = false;
        restoredRef.current = false;
        clearBrowserDraft();
        router.push("/admin/posts");
        router.refresh();
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "保存失败，请稍后重试");
      }
    });
  };

  const saveDraft = (formData: FormData) => submitPost(formData, "draft");
  const publish = (formData: FormData) => submitPost(formData, "publish");

  const resolveDraftConflict = (restoreLocal: boolean) => {
    if (restoreLocal && conflictingDraft) applyBrowserDraft(conflictingDraft);
    else clearBrowserDraft();
    setConflictingDraft(null);
    restoredRef.current = true;
    setRestored(true);
  };

  return (
    <>
    <form action={saveDraft}>
      {post.id && <input type="hidden" name="id" value={post.id} />}
      <input type="hidden" name="content" value={content} />
      <input type="hidden" name="tagIds" value={JSON.stringify(tagIds)} />
      <input type="hidden" name="categoryId" value={categoryId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="excerpt" value={excerpt} />
      {canLock && <input type="hidden" name="locked" value={locked ? "true" : "false"} />}
      {canLock && <input type="hidden" name="gateNote" value={gateNote} />}
      {canLock && <input type="hidden" name="keyIds" value={JSON.stringify(keyIds)} />}

      <div className="panel">
        <div className="ed-titlerow">
          <input
            className="title"
            value={title}
            name="title"
            onChange={(e) => setTitle(e.target.value)}
            placeholder="文章标题"
          />
          <span className={`status ${post.status === "PUBLISHED" ? "pub" : "draft"}`}>
            {post.status === "PUBLISHED" ? "已发布" : "草稿"}
          </span>
        </div>

        <div className="ed-meta">
          <div className="m">
            链接{" "}
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="自动生成"
              style={{ width: 170 }}
            />
          </div>
          <div className="m">
            分组{" "}
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">（未分组）</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <span className="sp" style={{ marginLeft: "auto" }} />
          <button
            type="submit"
            formAction={saveDraft}
            className="btn sm"
            disabled={saving}
          >
            {saving ? "保存中…" : "保存草稿"}
          </button>
          <button
            type="submit"
            formAction={publish}
            className="btn primary sm"
            disabled={saving}
          >
            {post.status === "PUBLISHED" ? "更新发布" : "发布"}
          </button>
          {browserDraftStatus && <span className="post-browser-draft-status">{browserDraftStatus}</span>}
        </div>
        {saveError && <div className="post-editor-save-error" role="alert">{saveError}</div>}

        <div className="ed-tools">
          <button type="button" title="加粗" onClick={() => insert("粗体", "**")}>
            <b>B</b>
          </button>
          <button type="button" title="斜体" onClick={() => insert("斜体", "*")}>
            <i>I</i>
          </button>
          <button type="button" title="标题" onClick={() => insert("\n## 标题\n")}>
            H
          </button>
          <span className="gap" />
          <button type="button" title="链接" onClick={() => insert("[文字](https://)")}>
            🔗
          </button>
          <button type="button" title="行内代码" onClick={() => insert("代码", "`")}>
            {"<>"}
          </button>
          <button type="button" title="代码块" onClick={() => insert("\n```python\n\n```\n")}>
            ▦
          </button>
          <button type="button" title="公式" onClick={() => insert("\n$$\n\n$$\n")}>
            ∑
          </button>
          <button type="button" title="引用" onClick={() => insert("\n> 引用\n")}>
            ❝
          </button>
          <button type="button" title="列表" onClick={() => insert("\n- 项目\n")}>
            ≔
          </button>
          <span className="gap" />
          <button
            type="button"
            title="折叠框"
            onClick={() =>
              insert(
                "\n<details>\n<summary>标题</summary>\n\n内容\n\n</details>\n",
              )
            }
          >
            ▸
          </button>
          <button
            type="button"
            title="提示框"
            onClick={() =>
              insert('\n<div class="callout info">\n\n提示内容\n\n</div>\n')
            }
          >
            ⚑
          </button>
          <button
            type="button"
            title="分栏"
            onClick={() =>
              insert(
                '\n<div class="cols">\n<div><markdown>\n\n左栏内容\n\n</markdown></div>\n<div><markdown>\n\n右栏内容\n\n</markdown></div>\n</div>\n',
              )
            }
          >
            ▥
          </button>
          <button
            type="button"
            title="徽章"
            onClick={() => insert('<span class="badge">标记</span>')}
          >
            ⬡
          </button>
          <button
            type="button"
            title="Markdown 区块（强制把内容当 Markdown 渲染）"
            onClick={() => insert("<markdown>\n\n内容\n\n</markdown>")}
          >
            M↓
          </button>
          <span className="gap" />
          <label
            title="上传图片"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 32,
              height: 30,
              border: "1px solid var(--aline)",
              borderRadius: 5,
              cursor: "pointer",
              color: uploading ? "var(--aaccent)" : "var(--soft)",
            }}
          >
            {uploading ? "…" : "⬆"}
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        <div className="ed-paneh">
          <div>Markdown 源</div>
          <div>实时预览</div>
        </div>
        <div className="editor">
          <MarkdownEditor
            value={content}
            height="520px"
            onChange={handleContentChange}
            onCreateEditor={(view) => {
              viewRef.current = view;
            }}
          />
          <div className="ed-pv">
            <div className="body" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        </div>
      </div>

      {/* 标签选择 */}
      <div className="panel">
        <div className="h">
          <h2>标签</h2>
        </div>
        <div className="b">
          {taxonomy.length === 0 && (
            <p style={{ color: "var(--amuted)", fontSize: 13 }}>
              暂无标签，请先在「分类法」中创建。
            </p>
          )}
          {taxonomy.map((cat) => (
            <div key={cat.id} style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: "var(--soft)", marginBottom: 6 }}>
                {cat.name}
              </div>
              {cat.tagGroups.map((g) => (
                <div key={g.id} style={{ marginLeft: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: "var(--amuted)" }}>{g.name}：</span>
                  {g.tags.map((t) => (
                    <label key={t.id} style={{ marginRight: 12, fontSize: 13, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={tagIds.includes(t.id)}
                        onChange={() => toggleTag(t.id)}
                        style={{ marginRight: 4 }}
                      />
                      {t.name}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          ))}
          <div className="fld" style={{ marginTop: 8, maxWidth: 420 }}>
            <label>摘要（可空，自动截取正文）</label>
            <textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} />
          </div>
        </div>
      </div>

      {canLock && (
        <div className="panel">
          <div className="h">
            <h2>访问控制</h2>
          </div>
          <div className="b">
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={locked}
                onChange={(e) => setLocked(e.target.checked)}
              />
              给本文上锁（需输入密钥才能阅读）
            </label>
            <div className="fld" style={{ marginTop: 12, maxWidth: 520 }}>
              <label>解锁界面说明（文章概要 / 为什么上锁 / 密钥获取途径）</label>
              <textarea
                value={gateNote}
                onChange={(e) => setGateNote(e.target.value)}
                rows={4}
              />
            </div>
            <div className="fld" style={{ marginTop: 12 }}>
              <label>可用于解锁本文的密钥</label>
              {allKeys.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--amuted)", marginTop: 4 }}>
                  还没有密钥，请先在「访问密钥」页创建
                </p>
              ) : (
                <div className="keypick-list">
                  {allKeys.map((k) => {
                    const checked = keyIds.includes(k.id);
                    return (
                      <label key={k.id} className={`keypick${checked ? " on" : ""}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleKey(k.id)}
                        />
                        <span className="keypick-main">
                          <span className="keypick-name">
                            {k.label || "（未命名密钥）"}
                          </span>
                          <span className="keypick-meta">
                            {k.active ? "" : "已停用 · "}
                            已用 {k.usedCount}
                            {k.maxUses === null ? "" : ` / ${k.maxUses}`} 次
                            {k.validUntil ? ` · 截止 ${k.validUntil}` : ""}
                          </span>
                        </span>
                        {checked && <span className="keypick-check">✓</span>}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            <p style={{ fontSize: 12, color: "var(--amuted)", marginTop: 8 }}>
              密钥在「访问密钥」页管理。上锁但无任何启用密钥覆盖的文章，读者将无法解锁。
            </p>
          </div>
        </div>
      )}
    </form>

      {canReset && post.id && (
        <form action={resetViews} ref={resetFormRef} style={{ marginTop: 16 }}>
          <input type="hidden" name="id" value={post.id} />
          <div className="panel">
            <div className="h">
              <h2>阅读统计</h2>
            </div>
            <div
              className="b"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: 14, color: "var(--soft)" }}>
                当前阅读 <b style={{ color: "var(--aink)" }}>{formatViews(post.viewCount ?? 0)}</b> 次
              </span>
              <span className="sp" style={{ marginLeft: "auto" }} />
              <button
                type="button"
                className="btn sm"
                onClick={() => setResetOpen(true)}
              >
                重置阅读次数
              </button>
            </div>
          </div>
          <ConfirmDialog
            open={resetOpen}
            title="重置阅读次数"
            description={
              <>
                当前阅读 <b>{formatViews(post.viewCount ?? 0)}</b> 次，重置后该数据归零且无法恢复。
              </>
            }
            confirmText="重置"
            onCancel={() => setResetOpen(false)}
            onConfirm={() => {
              setResetOpen(false);
              resetFormRef.current?.requestSubmit();
            }}
          />
        </form>
      )}
      <ConfirmDialog
        open={Boolean(conflictingDraft)}
        title="发现浏览器草稿与服务器版本冲突"
        description={
          conflictingDraft ? (
            <>
              浏览器草稿保存于 {new Date(conflictingDraft.savedAt).toLocaleString("zh-CN")}，但服务器文章之后已发生变化。请选择要继续编辑的版本。
            </>
          ) : null
        }
        cancelText="使用服务器版本"
        confirmText="恢复浏览器草稿"
        dismissible={false}
        onCancel={() => resolveDraftConflict(false)}
        onConfirm={() => resolveDraftConflict(true)}
      />
    </>
  );
}
