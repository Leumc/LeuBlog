import Link from "next/link";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR, allowedExt } from "@/lib/uploads";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { ensureMediaSchema } from "@/lib/media-schema";
import {
  createMediaCategory,
  deleteMedia,
  deleteMediaCategory,
  updateMediaMetadata,
} from "./actions";
import MediaUploader from "./MediaUploader";
import CopyLink from "./CopyLink";
import PreviewImage from "./PreviewImage";

export const dynamic = "force-dynamic";

type Category = {
  id: string;
  name: string;
  parentId: string | null;
  _count: { assets: number };
};
type CategoryNode = Category & { children: CategoryNode[] };

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + " MB";
  return Math.max(1, Math.round(bytes / 1024)) + " KB";
}

function categoryTree(categories: Category[]): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>(
    categories.map((category) => [category.id, { ...category, children: [] }]),
  );
  const roots: CategoryNode[] = [];
  nodes.forEach((node) => {
    const parent = node.parentId ? nodes.get(node.parentId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  });
  return roots;
}

function flattenCategories(nodes: CategoryNode[], depth = 0): { category: CategoryNode; depth: number }[] {
  return nodes.flatMap((node) => [
    { category: node, depth },
    ...flattenCategories(node.children, depth + 1),
  ]);
}

function CategoryRows({
  nodes,
  selected,
  depth = 0,
}: {
  nodes: CategoryNode[];
  selected?: string;
  depth?: number;
}) {
  return nodes.map((category) => (
    <div key={category.id}>
      <div className={`media-category-row${selected === category.id ? " on" : ""}`} style={{ paddingLeft: 12 + depth * 18 }}>
        <Link href={`/admin/media?category=${category.id}`} title={category.name}>
          <span aria-hidden="true">{category.children.length ? "▾" : "·"}</span>
          <span>{category.name}</span>
          <span className="cnt">{category._count.assets}</span>
        </Link>
        <form action={deleteMediaCategory}>
          <input type="hidden" name="id" value={category.id} />
          <button className="rm" title={`删除分类 ${category.name}`} aria-label={`删除分类 ${category.name}`}>×</button>
        </form>
      </div>
      <CategoryRows nodes={category.children} selected={selected} depth={depth + 1} />
    </div>
  ));
}

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  await requireAdmin();
  await ensureMediaSchema();
  const { category: selected } = await searchParams;

  let diskFiles: { name: string; size: number; mtime: number }[] = [];
  try {
    const names = (await readdir(UPLOAD_DIR)).filter(allowedExt);
    diskFiles = await Promise.all(
      names.map(async (name) => {
        const info = await stat(path.join(UPLOAD_DIR, name));
        return { name, size: info.size, mtime: info.mtimeMs };
      }),
    );
  } catch {
    diskFiles = [];
  }

  const [categories, metadata] = await Promise.all([
    prisma.mediaCategory.findMany({
      orderBy: [{ name: "asc" }],
      include: { _count: { select: { assets: true } } },
    }),
    prisma.mediaAsset.findMany(),
  ]);
  const metadataByName = new Map(metadata.map((item) => [item.filename, item]));
  const files = diskFiles
    .map((file) => ({ ...file, metadata: metadataByName.get(file.name) }))
    .filter((file) => {
      if (!selected) return true;
      if (selected === "uncategorized") return !file.metadata?.categoryId;
      return file.metadata?.categoryId === selected;
    })
    .sort((a, b) => b.mtime - a.mtime);

  const tree = categoryTree(categories);
  const flatCategories = flattenCategories(tree);
  const totalMB = diskFiles.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024;
  const uncategorizedCount = diskFiles.filter((file) => !metadataByName.get(file.name)?.categoryId).length;

  return (
    <div className="panel">
      <div className="h">
        <h2>媒体库</h2>
        <span className="right" style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--soft)" }}>
          已用 {totalMB.toFixed(1)} MB · 共 {diskFiles.length} 个文件
        </span>
      </div>
      <div className="b">
        <MediaUploader />
        <div className="media-library-layout">
          <aside className="media-categories">
            <div className="media-categories-title">图片分类</div>
            <Link className={`media-category-link${!selected ? " on" : ""}`} href="/admin/media">
              全部图片 <span>{diskFiles.length}</span>
            </Link>
            <Link className={`media-category-link${selected === "uncategorized" ? " on" : ""}`} href="/admin/media?category=uncategorized">
              未分类 <span>{uncategorizedCount}</span>
            </Link>
            <CategoryRows nodes={tree} selected={selected} />
            <form className="media-category-create" action={createMediaCategory}>
              <input name="name" placeholder="新分类名称" required maxLength={80} />
              <select name="parentId" defaultValue="">
                <option value="">作为顶级分类</option>
                {flatCategories.map(({ category, depth }) => (
                  <option key={category.id} value={category.id}>
                    {"　".repeat(depth)}{category.name}
                  </option>
                ))}
              </select>
              <button className="btn sm primary">新建分类</button>
            </form>
            <p className="media-category-hint">分类是虚拟目录，创建、移动或删除分类都不会改变图片文件路径。</p>
          </aside>

          <section className="media-results">
            {files.length === 0 ? (
              <p className="media-empty">当前分类中没有图片。</p>
            ) : (
              <div className="media">
                {files.map((file) => {
                  const displayName = file.metadata?.displayName || file.name;
                  const url = `/uploads/${file.name}`;
                  return (
                    <div className="m" key={file.name}>
                      <div className="ph"><PreviewImage src={url} alt={displayName} /></div>
                      <div className="mi">
                        <form action={updateMediaMetadata} className="media-meta-form">
                          <input type="hidden" name="filename" value={file.name} />
                          <label>
                            <span>显示名</span>
                            <input name="displayName" defaultValue={file.metadata?.displayName ?? ""} placeholder={file.name} maxLength={160} />
                          </label>
                          <label>
                            <span>分类</span>
                            <select name="categoryId" defaultValue={file.metadata?.categoryId ?? ""}>
                              <option value="">未分类</option>
                              {flatCategories.map(({ category, depth }) => (
                                <option key={category.id} value={category.id}>
                                  {"　".repeat(depth)}{category.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button className="btn sm" type="submit">保存</button>
                        </form>
                        <div className="media-actual-name" title={file.name}>实际文件：{file.name}</div>
                        <div className="sz">
                          <span>{fmtSize(file.size)}</span>
                          <span className="media-actions">
                            <CopyLink url={url} />
                            <form action={deleteMedia}>
                              <input type="hidden" name="name" value={file.name} />
                              <button className="lk del">删除</button>
                            </form>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
