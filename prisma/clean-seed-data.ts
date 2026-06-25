/**
 * 一次性清理脚本：删除早期 seed 注入的示例内容。
 * 保留：管理员账号、站点设置、以及你自己创建的真实内容。
 *
 * 用法（本地）：  npx tsx prisma/clean-seed-data.ts
 * 用法（容器）：  docker compose exec app npx tsx prisma/clean-seed-data.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// seed 曾注入的示例数据标识
const SAMPLE_POST_SLUGS = [
  "binary-tree-basics",
  "knapsack-01",
  "segment-tree-intro",
  "process-scheduling",
];
const SAMPLE_CATEGORY_SLUGS = ["algorithm", "cs"];
const SAMPLE_TAG_GROUP_SLUGS = ["data-structure", "dynamic-programming", "operating-system"];
const SAMPLE_TAG_NAMES = ["二叉树", "平衡树", "线段树", "背包问题", "区间DP", "进程调度"];
const SAMPLE_PORTAL_TITLES = ["GitHub", "示例友链"];
const SAMPLE_ANNOUNCEMENT = "网站已上线，欢迎阅读算法与计算机技术笔记。";

async function main() {
  // 示例文章
  const posts = await prisma.post.deleteMany({ where: { slug: { in: SAMPLE_POST_SLUGS } } });
  // 示例公告
  const anns = await prisma.announcement.deleteMany({ where: { content: SAMPLE_ANNOUNCEMENT } });
  // 示例传送门
  const portals = await prisma.portal.deleteMany({ where: { title: { in: SAMPLE_PORTAL_TITLES } } });
  // 示例标签（先解除与文章的关联由 onDelete 处理；标签直接删）
  const tags = await prisma.tag.deleteMany({ where: { name: { in: SAMPLE_TAG_NAMES } } });
  // 示例标签组
  const tagGroups = await prisma.tagGroup.deleteMany({
    where: { slug: { in: SAMPLE_TAG_GROUP_SLUGS } },
  });
  // 示例分组（仅当其下已无文章时删，避免误删你挂在该分组下的真实文章的分组）
  let catDeleted = 0;
  for (const slug of SAMPLE_CATEGORY_SLUGS) {
    const cat = await prisma.category.findUnique({
      where: { slug },
      include: { _count: { select: { posts: true } } },
    });
    if (cat && cat._count.posts === 0) {
      await prisma.category.delete({ where: { id: cat.id } });
      catDeleted++;
    } else if (cat) {
      console.log(`分组「${cat.name}」下仍有文章，保留。`);
    }
  }
  // 示例随机访问量：早期 seed 造了 30 天全站随机数据（postId 为空）。
  // 清空所有访问统计，让趋势图从真实访问重新累积。
  const views = await prisma.dailyView.deleteMany({});

  console.log("已删除：");
  console.log("  文章", posts.count);
  console.log("  公告", anns.count);
  console.log("  传送门", portals.count);
  console.log("  标签", tags.count);
  console.log("  标签组", tagGroups.count);
  console.log("  分组", catDeleted);
  console.log("  访问量记录", views.count);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
