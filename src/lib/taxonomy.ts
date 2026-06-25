import "server-only";
import { prisma } from "@/lib/prisma";
import type { Taxonomy } from "@/components/admin/PostEditor";

export async function getEditorTaxonomy(): Promise<{
  categories: { id: string; name: string }[];
  taxonomy: Taxonomy;
}> {
  const categories = await prisma.category.findMany({
    orderBy: { order: "asc" },
    include: {
      tagGroups: {
        orderBy: { order: "asc" },
        include: { tags: { orderBy: { name: "asc" } } },
      },
    },
  });
  return {
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
    taxonomy: categories.map((c) => ({
      id: c.id,
      name: c.name,
      tagGroups: c.tagGroups.map((g) => ({
        id: g.id,
        name: g.name,
        tags: g.tags.map((t) => ({ id: t.id, name: t.name })),
      })),
    })),
  };
}
