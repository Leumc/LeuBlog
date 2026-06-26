import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { canEditPost } from "@/lib/permissions";
import PostEditor from "@/components/admin/PostEditor";
import { getEditorTaxonomy } from "@/lib/taxonomy";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = (await getSessionUser())!;
  const post = await prisma.post.findUnique({
    where: { id },
    include: { tags: true, accessKeys: { select: { id: true } } },
  });
  if (!post) notFound();
  if (!canEditPost(user, post.authorId)) redirect("/admin/posts");

  const [{ categories, taxonomy }, keys] = await Promise.all([
    getEditorTaxonomy(),
    prisma.accessKey.findMany({ select: { id: true, label: true }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <PostEditor
      post={{
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt ?? "",
        content: post.content,
        status: post.status,
        categoryId: post.categoryId,
        tagIds: post.tags.map((t) => t.id),
        locked: post.locked,
        gateNote: post.gateNote ?? "",
        keyIds: post.accessKeys.map((k) => k.id),
      }}
      categories={categories}
      taxonomy={taxonomy}
      canLock={user.role === "ADMIN"}
      allKeys={keys.map((k) => ({ id: k.id, label: k.label ?? "" }))}
    />
  );
}
