import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/access-keys";
import { deleteAccessKey, resetUsage } from "./actions";
import AccessKeyForm, { type AccessKeyInit, type PostOption } from "@/components/admin/AccessKeyForm";

export const dynamic = "force-dynamic";

function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default async function AccessKeysPage() {
  const [keys, posts] = await Promise.all([
    prisma.accessKey.findMany({
      orderBy: { createdAt: "desc" },
      include: { posts: { select: { id: true } } },
    }),
    prisma.post.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      select: { id: true, title: true },
    }),
  ]);
  const postOptions: PostOption[] = posts;

  return (
    <div>
      <div className="panel">
        <div className="h">
          <h2>新建访问密钥</h2>
        </div>
        <AccessKeyForm posts={postOptions} />
      </div>

      {keys.map((k) => {
        const init: AccessKeyInit = {
          id: k.id,
          label: k.label ?? "",
          secret: decryptSecret(k.secretEnc),
          note: k.note ?? "",
          maxUses: k.maxUses === null ? "" : String(k.maxUses),
          validUntil: k.validUntil ? toLocalInput(k.validUntil) : "",
          active: k.active,
          postIds: k.posts.map((p) => p.id),
        };
        return (
          <div className="panel" key={k.id}>
            <div className="h" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 style={{ margin: 0 }}>
                {k.label || "（未命名密钥）"} {k.active ? "" : "· 已停用"}
              </h2>
              <span style={{ fontSize: 12, color: "var(--amuted)", marginLeft: "auto" }}>
                已用 {k.usedCount}
                {k.maxUses === null ? "" : ` / ${k.maxUses}`} 次 · 覆盖 {k.posts.length} 篇
                {k.validUntil ? ` · 截止 ${k.validUntil.toLocaleString("zh-CN")}` : ""}
              </span>
              <form action={resetUsage}>
                <input type="hidden" name="id" value={k.id} />
                <button type="submit" className="btn sm">重置次数</button>
              </form>
              <form action={deleteAccessKey}>
                <input type="hidden" name="id" value={k.id} />
                <button type="submit" className="btn sm danger">删除</button>
              </form>
            </div>
            <AccessKeyForm init={init} posts={postOptions} />
          </div>
        );
      })}
    </div>
  );
}
