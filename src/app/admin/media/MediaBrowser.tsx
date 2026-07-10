"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import PreviewImage from "./PreviewImage";
import { createMediaCategory, deleteMedia, deleteMediaCategory, moveMedia, organizeLegacyMedia, renameMedia } from "./actions";

type ReferencePost = { id: string; title: string; slug: string; status: "DRAFT" | "PUBLISHED" };
export type BrowserFile = {
  id: string;
  displayName: string;
  filename: string;
  relativePath: string;
  url: string;
  size: number;
  mtime: number;
  references: ReferencePost[];
};
export type BrowserFolder = { id: string; name: string; childCount: number; assetCount: number };

type Dialog =
  | { type: "rename"; file: BrowserFile }
  | { type: "move"; file: BrowserFile }
  | { type: "references"; file: BrowserFile }
  | { type: "delete-file"; file: BrowserFile }
  | { type: "delete-folder"; folder: BrowserFolder }
  | { type: "organize" }
  | null;

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function MediaBrowser({
  currentFolderId,
  breadcrumbs,
  folders,
  allFolders,
  files,
  legacyOrganizeCount,
}: {
  currentFolderId: string | null;
  breadcrumbs: { id: string | null; name: string }[];
  folders: BrowserFolder[];
  allFolders: { id: string; name: string }[];
  files: BrowserFile[];
  legacyOrganizeCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!openMenu) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".media-card-menu-wrap")) return;
      setOpenMenu(null);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [openMenu]);

  const showDialog = (nextDialog: Exclude<Dialog, null>) => {
    setOpenMenu(null);
    setDialog(nextDialog);
  };

  const run = (action: (data: FormData) => Promise<void>, data: FormData) => {
    if (pending) return;
    setError("");
    startTransition(async () => {
      try {
        await action(data);
        setDialog(null);
        setOpenMenu(null);
        router.refresh();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "操作失败");
      }
    });
  };

  const refs = (file: BrowserFile) => file.references.length ? (
    <ul className="media-reference-list">
      {file.references.map((post) => (
        <li key={post.id}>
          <Link href={`/admin/posts/${post.id}/edit`}>{post.title}</Link>
          <span>{post.status === "PUBLISHED" ? "已发布" : "草稿"}</span>
        </li>
      ))}
    </ul>
  ) : <p>目前没有文章引用此图片。</p>;

  return (
    <div className="media-browser" aria-busy={pending}>
      <div className="media-browser-toolbar">
        <nav className="media-breadcrumb" aria-label="媒体文件夹路径">
          {breadcrumbs.map((item, index) => (
            <span key={item.id ?? "root"}>
              {index > 0 && <i>/</i>}
              {index === breadcrumbs.length - 1 ? (
                <b>{item.name}</b>
              ) : (
                <Link href={item.id ? `/admin/media?folder=${item.id}` : "/admin/media"}>{item.name}</Link>
              )}
            </span>
          ))}
        </nav>
        <form
          className="media-new-folder"
          action={(data) => {
            if (currentFolderId) data.set("parentId", currentFolderId);
            run(createMediaCategory, data);
          }}
        >
          <input name="name" required maxLength={80} placeholder="新文件夹名称" />
          <button className="btn sm primary" disabled={pending}>新建文件夹</button>
        </form>
      </div>
      {error && <p className="media-upload-error" role="alert">{error}</p>}
      {legacyOrganizeCount > 0 && (
        <div className="media-organize-banner">
          <span>有 {legacyOrganizeCount} 张旧图片尚未整理到对应的实际随机目录。</span>
          <button className="btn sm" type="button" onClick={() => setDialog({ type: "organize" })}>整理旧媒体</button>
        </div>
      )}

      {folders.length > 0 && (
        <div className="media-folder-grid">
          {folders.map((folder) => (
            <div className="media-folder" key={folder.id}>
              <Link href={`/admin/media?folder=${folder.id}`}>
                <span className="media-folder-icon" aria-hidden="true">▰</span>
                <span><b>{folder.name}</b><small>{folder.childCount} 个文件夹 · {folder.assetCount} 张图片</small></span>
              </Link>
              <button type="button" onClick={() => setDialog({ type: "delete-folder", folder })} aria-label={`删除文件夹 ${folder.name}`}>×</button>
            </div>
          ))}
        </div>
      )}

      {files.length > 0 ? (
        <div className="media">
          {files.map((file) => (
            <div className="m" key={file.id}>
              <div className="ph"><PreviewImage src={file.url} alt={file.displayName} /></div>
              <div className="mi">
                <div className="media-card-title" title={file.displayName}>{file.displayName}</div>
                <div className="sz"><span>{fmtSize(file.size)}</span><span>{file.references.length} 篇引用</span></div>
              </div>
              <div className="media-card-menu-wrap">
                <button
                  className="media-card-menu-button"
                  type="button"
                  aria-label={`管理 ${file.displayName}`}
                  onClick={() => setOpenMenu(openMenu === file.id ? null : file.id)}
                >•••</button>
                {openMenu === file.id && (
                  <div className="media-card-menu">
                    <button onClick={() => showDialog({ type: "rename", file })}>修改显示名</button>
                    <button onClick={() => showDialog({ type: "move", file })}>移动到文件夹</button>
                    <button onClick={() => showDialog({ type: "references", file })}>查看引用文章</button>
                    <button onClick={() => { setOpenMenu(null); navigator.clipboard?.writeText(file.url); }}>复制链接</button>
                    <button className="danger" onClick={() => showDialog({ type: "delete-file", file })}>删除图片</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : folders.length === 0 ? <p className="media-empty">当前文件夹为空。</p> : null}

      {dialog?.type === "rename" && (
        <div className="modal-backdrop" onClick={() => setDialog(null)}>
          <form className="modal" onClick={(event) => event.stopPropagation()} action={(data) => run(renameMedia, data)}>
            <h3>修改显示名</h3>
            <input type="hidden" name="id" value={dialog.file.id} />
            <div className="modal-body"><input name="displayName" required maxLength={160} defaultValue={dialog.file.displayName} autoFocus /></div>
            <div className="modal-actions"><button type="button" className="btn sm" onClick={() => setDialog(null)}>取消</button><button className="btn primary sm" disabled={pending}>保存</button></div>
          </form>
        </div>
      )}

      {dialog?.type === "move" && (
        <div className="modal-backdrop" onClick={() => setDialog(null)}>
          <form className="modal media-move-dialog" onClick={(event) => event.stopPropagation()} action={(data) => run(moveMedia, data)}>
            <h3>移动“{dialog.file.displayName}”</h3>
            <input type="hidden" name="id" value={dialog.file.id} />
            <div className="modal-body">
              <label>目标文件夹<select name="categoryId" defaultValue={currentFolderId ?? ""}><option value="">媒体库根目录</option>{allFolders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>
              <p className="media-warning">移动会改变图片实际 URL。确认后程序会自动更新下列站内文章；站外保存的旧链接仍会失效。</p>
              {refs(dialog.file)}
            </div>
            <div className="modal-actions"><button type="button" className="btn sm" onClick={() => setDialog(null)}>取消</button><button className="btn primary sm" disabled={pending}>确认移动并更新文章</button></div>
          </form>
        </div>
      )}

      {dialog?.type === "references" && (
        <div className="modal-backdrop" onClick={() => setDialog(null)}><div className="modal" onClick={(event) => event.stopPropagation()}><h3>引用“{dialog.file.displayName}”的文章</h3><div className="modal-body">{refs(dialog.file)}</div><div className="modal-actions"><button className="btn sm" onClick={() => setDialog(null)}>关闭</button></div></div></div>
      )}

      <ConfirmDialog
        open={dialog?.type === "delete-file"}
        title="确认删除图片"
        description={dialog?.type === "delete-file" ? <><p>将永久删除“{dialog.file.displayName}”及其实际文件，此操作不可撤销。</p>{dialog.file.references.length > 0 && <><p className="media-warning">以下文章会出现失效图片链接：</p>{refs(dialog.file)}</>}</> : null}
        confirmText="永久删除"
        onCancel={() => setDialog(null)}
        onConfirm={() => { if (dialog?.type === "delete-file") { const data = new FormData(); data.set("id", dialog.file.id); run(deleteMedia, data); } }}
      />
      <ConfirmDialog
        open={dialog?.type === "organize"}
        title="确认整理旧媒体目录"
        description={<>将把 {legacyOrganizeCount} 张图片移动到对应的随机物理目录，并自动更新站内文章链接。站外保存的旧 URL 仍会失效。</>}
        confirmText="确认整理并更新文章"
        onCancel={() => setDialog(null)}
        onConfirm={() => { if (dialog?.type === "organize") run(async () => organizeLegacyMedia(), new FormData()); }}
      />
      <ConfirmDialog
        open={dialog?.type === "delete-folder"}
        title="确认递归删除文件夹"
        description={dialog?.type === "delete-folder" ? <>文件夹“{dialog.folder.name}”及全部子文件夹会被删除，其中图片将移动到媒体库根目录，相关文章链接会自动更新。</> : null}
        confirmText="确认删除文件夹"
        onCancel={() => setDialog(null)}
        onConfirm={() => { if (dialog?.type === "delete-folder") { const data = new FormData(); data.set("id", dialog.folder.id); run(deleteMediaCategory, data); } }}
      />
    </div>
  );
}
