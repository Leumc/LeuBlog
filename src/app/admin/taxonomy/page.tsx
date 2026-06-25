import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  createCategory,
  deleteCategory,
  createTagGroup,
  deleteTagGroup,
  createTag,
  deleteTag,
} from "./actions";

export default async function TaxonomyPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; g?: string }>;
}) {
  const { cat, g } = await searchParams;

  const categories = await prisma.category.findMany({
    orderBy: { order: "asc" },
    include: {
      _count: { select: { posts: { where: { status: "PUBLISHED" } } } },
      tagGroups: {
        orderBy: { order: "asc" },
        include: { _count: { select: { tags: true } } },
      },
    },
  });

  const selCat = categories.find((c) => c.id === cat) ?? categories[0];
  const groups = selCat?.tagGroups ?? [];
  const selGroup = groups.find((x) => x.id === g) ?? groups[0];
  const tags = selGroup
    ? await prisma.tag.findMany({
        where: { tagGroupId: selGroup.id },
        orderBy: { name: "asc" },
        include: { _count: { select: { posts: true } } },
      })
    : [];

  const catHref = (id: string) => `/admin/taxonomy?cat=${id}`;
  const groupHref = (gid: string) => `/admin/taxonomy?cat=${selCat?.id}&g=${gid}`;

  return (
    <>
      <div className="note">
        三级层次：<b>文章分组 → 标签组 → 标签</b>。在左列选择分组，中列管理其标签组，右列管理标签组下的标签。
      </div>
      <div className="panel">
        <div className="tax">
          {/* 分组 */}
          <div className="col">
            <div className="colh">文章分组</div>
            {categories.map((c) => (
              <div key={c.id} className={`it${selCat?.id === c.id ? " on" : ""}`}>
                <Link href={catHref(c.id)} style={{ flex: 1, display: "flex", alignItems: "center", color: "inherit" }}>
                  {c.name}
                  <span className="cnt">{c._count.posts}</span>
                </Link>
                <form action={deleteCategory} style={{ marginLeft: 6 }}>
                  <input type="hidden" name="id" value={c.id} />
                  <button className="rm" title="删除">
                    ×
                  </button>
                </form>
              </div>
            ))}
            {categories.length === 0 && <div className="empty">还没有分组</div>}
            <form className="addrow" action={createCategory}>
              <input name="name" placeholder="新建分组…" required />
              <button className="btn sm primary">＋</button>
            </form>
          </div>

          {/* 标签组 */}
          <div className="col">
            <div className="colh">{selCat ? `「${selCat.name}」的标签组` : "标签组"}</div>
            {groups.map((gr) => (
              <div key={gr.id} className={`it${selGroup?.id === gr.id ? " on" : ""}`}>
                <Link href={groupHref(gr.id)} style={{ flex: 1, display: "flex", alignItems: "center", color: "inherit" }}>
                  {gr.name}
                  <span className="cnt">{gr._count.tags}</span>
                </Link>
                <form action={deleteTagGroup} style={{ marginLeft: 6 }}>
                  <input type="hidden" name="id" value={gr.id} />
                  <button className="rm" title="删除">
                    ×
                  </button>
                </form>
              </div>
            ))}
            {selCat && groups.length === 0 && <div className="empty">该分组下还没有标签组</div>}
            {selCat && (
              <form className="addrow" action={createTagGroup}>
                <input type="hidden" name="categoryId" value={selCat.id} />
                <input name="name" placeholder="新建标签组…" required />
                <button className="btn sm primary">＋</button>
              </form>
            )}
          </div>

          {/* 标签 */}
          <div className="col">
            <div className="colh">{selGroup ? `「${selGroup.name}」的标签` : "标签"}</div>
            {tags.map((t) => (
              <div key={t.id} className="it">
                {t.name}
                <span className="cnt">{t._count.posts}</span>
                <form action={deleteTag} style={{ marginLeft: 6 }}>
                  <input type="hidden" name="id" value={t.id} />
                  <button className="rm" title="删除">
                    ×
                  </button>
                </form>
              </div>
            ))}
            {selGroup && tags.length === 0 && <div className="empty">该标签组下还没有标签</div>}
            {selGroup && (
              <form className="addrow" action={createTag}>
                <input type="hidden" name="tagGroupId" value={selGroup.id} />
                <input name="name" placeholder="新建标签…" required />
                <button className="btn sm primary">＋</button>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
