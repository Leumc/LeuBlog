import PostEditor from "@/components/admin/PostEditor";
import { getEditorTaxonomy } from "@/lib/taxonomy";
import { getSessionUser } from "@/lib/auth";

export default async function NewPostPage() {
  const user = (await getSessionUser())!;
  const { categories, taxonomy } = await getEditorTaxonomy();
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
      }}
      categories={categories}
      taxonomy={taxonomy}
      canLock={user.role === "ADMIN"}
    />
  );
}
