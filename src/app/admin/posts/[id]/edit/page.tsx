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
    include: { tags: true },
  });
  if (!post) notFound();
  if (!canEditPost(user, post.authorId)) redirect("/admin/posts");

  const { categories, taxonomy } = await getEditorTaxonomy();

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
      }}
      categories={categories}
      taxonomy={taxonomy}
    />
  );
}
