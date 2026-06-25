import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { formatViews } from "@/lib/utils";
import { deletePost } from "./post-actions";

function fmt(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(
    d.getHours(),
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default async function AdminPostsPage() {
  const user = (await getSessionUser())!;
  const isAdmin = user.role === "ADMIN";
  const posts = await prisma.post.findMany({
    where: isAdmin ? {} : { authorId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { category: true, author: true, tags: true },
  });

  return (
    <div className="panel">
      <div className="h" style={{ gap: 10 }}>
        <div className="toolbar" style={{ flex: 1 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>全部文章</span>
          <span className="sp" />
          <Link className="btn primary" href="/admin/posts/new">
            ＋ 写文章
          </Link>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>标题</th>
            <th>分组 / 标签</th>
            <th>作者</th>
            <th>状态</th>
            <th className="num">阅读</th>
            <th>更新时间</th>
            <th style={{ width: 150 }} />
          </tr>
        </thead>
        <tbody>
          {posts.map((p) => (
            <tr key={p.id}>
              <td>
                <div className="ttl">{p.title}</div>
                <div className="sub2">
                  {p.status === "PUBLISHED" ? `/posts/${p.slug}` : "草稿 · 未公开"}
                </div>
              </td>
              <td>
                {p.category && <span className="tag">{p.category.name}</span>}{" "}
                {p.tags.slice(0, 3).map((t) => (
                  <span className="tag" key={t.id}>
                    {t.name}
                  </span>
                ))}
              </td>
              <td>{p.author.displayName}</td>
              <td>
                <span className={`status ${p.status === "PUBLISHED" ? "pub" : "draft"}`}>
                  {p.status === "PUBLISHED" ? "已发布" : "草稿"}
                </span>
              </td>
              <td className="num">{p.status === "PUBLISHED" ? formatViews(p.viewCount) : "—"}</td>
              <td>{fmt(p.updatedAt)}</td>
              <td>
                <div className="acts">
                  <Link className="lk" href={`/admin/posts/${p.id}/edit`}>
                    编辑
                  </Link>
                  {p.status === "PUBLISHED" && (
                    <Link className="lk" href={`/posts/${p.slug}`} target="_blank">
                      预览
                    </Link>
                  )}
                  <form action={deletePost}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="lk del">删除</button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
          {posts.length === 0 && (
            <tr>
              <td colSpan={7} style={{ textAlign: "center", color: "var(--amuted)", padding: "30px" }}>
                还没有文章，点击右上角「写文章」开始。
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div
        className="h"
        style={{ borderTop: "1px solid var(--aline)", borderBottom: "none", color: "var(--soft)", fontSize: 12.5 }}
      >
        共 {posts.length} 篇
      </div>
    </div>
  );
}
