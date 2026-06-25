import PostEditor from "@/components/admin/PostEditor";
import { getEditorTaxonomy } from "@/lib/taxonomy";

export default async function NewPostPage() {
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
      }}
      categories={categories}
      taxonomy={taxonomy}
    />
  );
}
