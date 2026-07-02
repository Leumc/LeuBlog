"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { EditorView } from "@codemirror/view";
import { savePostAsDraft, publishPost, resetViews } from "@/app/admin/posts/post-actions";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { formatViews } from "@/lib/utils";
import {
  getMarkdownEditorBasicSetup,
  getMarkdownEditorExtensions,
} from "./markdown-editor-config";

const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), { ssr: false });

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
};

export type Taxonomy = {
  id: string;
  name: string;
  tagGroups: { id: string; name: string; tags: { id: string; name: string }[] }[];
}[];

export default function PostEditor({
  post,
  categories,
  taxonomy,
  canLock,
  canReset,
  allKeys,
}: {
  post: EditorPost;
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
  const resetFormRef = useRef<HTMLFormElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const handleContentChange = useCallback((value: string) => {
    setContent(value);
  }, []);

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

  return (
    <>
    <form action={savePostAsDraft}>
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
            formAction={savePostAsDraft}
            className="btn sm"
          >
            保存草稿
          </button>
          <button
            type="submit"
            formAction={publishPost}
            className="btn primary sm"
          >
            {post.status === "PUBLISHED" ? "更新发布" : "发布"}
          </button>
        </div>

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
          <CodeMirror
            value={content}
            height="520px"
            extensions={getMarkdownEditorExtensions()}
            onChange={handleContentChange}
            onCreateEditor={(view) => {
              viewRef.current = view;
            }}
            basicSetup={getMarkdownEditorBasicSetup()}
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
    </>
  );
}
