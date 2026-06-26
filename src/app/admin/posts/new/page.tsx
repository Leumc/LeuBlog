import PostEditor from "@/components/admin/PostEditor";
import { getEditorTaxonomy } from "@/lib/taxonomy";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function NewPostPage() {
  const user = (await getSessionUser())!;
  const [{ categories, taxonomy }, keys] = await Promise.all([
    getEditorTaxonomy(),
    prisma.accessKey.findMany({ select: { id: true, label: true }, orderBy: { createdAt: "desc" } }),
  ]);
  return (
    <PostEditor
      post={{
        title: "",
        slug: "",
        excerpt: "",
        content: "",
        status: "DRAFT",
        categoryId: null,
        tagIds: [],
        locked: false,
        gateNote: "",
        keyIds: [],
      }}
      categories={categories}
      taxonomy={taxonomy}
      canLock={user.role === "ADMIN"}
      allKeys={keys.map((k) => ({ id: k.id, label: k.label ?? "" }))}
    />
  );
}
