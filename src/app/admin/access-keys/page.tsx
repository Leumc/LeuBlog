import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/access-keys";
import AccessKeyForm, { type AccessKeyInit } from "@/components/admin/AccessKeyForm";
import AccessKeyCard from "@/components/admin/AccessKeyCard";

export const dynamic = "force-dynamic";

function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function safeDecrypt(enc: string): string {
  try {
    return decryptSecret(enc);
  } catch {
    return "";
  }
}

export default async function AccessKeysPage() {
  const keys = await prisma.accessKey.findMany({
    include: { posts: { select: { id: true, title: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="panel">
        <div className="h">
          <h2>新建访问密钥</h2>
        </div>
        <AccessKeyForm />
      </div>

      {keys.map((k) => {
        const plain = safeDecrypt(k.secretEnc);
        const decryptFailed = plain === "";
        const init: AccessKeyInit = {
          id: k.id,
          label: k.label ?? "",
          secret: plain,
          note: k.note ?? "",
          maxUses: k.maxUses === null ? "" : String(k.maxUses),
          validUntil: k.validUntil ? toLocalInput(k.validUntil) : "",
          active: k.active,
        };
        return (
          <AccessKeyCard
            key={k.id}
            init={init}
            usedCount={k.usedCount}
            maxUses={k.maxUses}
            active={k.active}
            decryptFailed={decryptFailed}
            validityLabel={k.validUntil ? `截止 ${k.validUntil.toLocaleString("zh-CN")}` : ""}
            posts={k.posts}
          />
        );
      })}
    </div>
  );
}
