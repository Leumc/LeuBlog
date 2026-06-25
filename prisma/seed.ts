import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function slugify(input: string): string {
  return (
    input
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\p{L}\p{N}\-]/gu, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "x"
  );
}

const BINARY_TREE = `二叉树是每个节点最多有两个子节点的树形结构，分别称为**左子节点**与**右子节点**。它是算法学习中最基础也最重要的数据结构之一。

## 基本定义

一棵二叉树要么为空，要么由一个根节点以及两棵互不相交的子树组成。我们通常这样定义节点：

\`\`\`cpp
struct TreeNode {
    int val;
    TreeNode *left;
    TreeNode *right;
    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
};
\`\`\`

对于一棵有 $n$ 个节点的二叉树，其高度 $h$ 满足：

$$\\lceil \\log_2(n+1) \\rceil \\le h \\le n$$

当树退化为链时取上界 $n$，当树为完全二叉树时取下界。

## 三种深度优先遍历

深度优先遍历按照访问根节点的时机分为前序、中序、后序三种。以中序遍历为例：

\`\`\`python
def inorder(root):
    if not root:
        return
    inorder(root.left)
    print(root.val)      # 访问根
    inorder(root.right)
\`\`\`

> 中序遍历二叉搜索树（BST）会得到一个**升序序列**，这是 BST 最重要的性质之一。

## 层序遍历

层序遍历借助队列按层访问，时间复杂度为 $O(n)$：

\`\`\`python
from collections import deque

def level_order(root):
    if not root:
        return []
    q, res = deque([root]), []
    while q:
        node = q.popleft()
        res.append(node.val)
        if node.left:  q.append(node.left)
        if node.right: q.append(node.right)
    return res
\`\`\`

## 复杂度小结

| 操作 | 平均 | 最坏 |
|---|---|---|
| 查找（BST） | $O(\\log n)$ | $O(n)$ |
| 插入（BST） | $O(\\log n)$ | $O(n)$ |
| 遍历 | $O(n)$ | $O(n)$ |

掌握了二叉树的遍历，就为后续学习平衡树、堆、线段树等结构打下了基础。
`;

async function main() {
  const email = (process.env.ADMIN_EMAIL || "admin@leublog.local").toLowerCase();
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "changeme123";
  const displayName = process.env.ADMIN_DISPLAY_NAME || "站长";

  // 唯一管理员
  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN" },
    create: {
      email,
      username,
      passwordHash,
      role: "ADMIN",
      displayName,
      bio: "本站站长，分享算法与计算机技术。",
    },
  });
  console.log("管理员就绪:", admin.username);

  // 站点设置
  const settings: Record<string, string> = {
    "site.name": process.env.SITE_NAME || "LeuBlog",
    "site.subtitle": "算法学习记录 与 计算机技术教程",
    "masthead.kicker": "Algorithms · Computer Science · Notes",
    "masthead.title": process.env.SITE_NAME || "LeuBlog",
    "masthead.subtitle": "算法学习记录 与 计算机技术教程",
    "home.postCount": "8",
    "portal.placement": "sidebar",
    "about.content":
      "# 关于 LeuBlog\n\n这里记录我的**算法学习**与**计算机技术**笔记，偏向系统性的整理与讲解。\n\n所有文章使用 Markdown 撰写，支持 LaTeX 公式与代码高亮。",
    "about.contact": "邮箱：" + email,
    "about.colophon": "由 Next.js + SQLite + Prisma 构建，部署于 2 核 2G 轻量 VPS。",
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.siteSetting.upsert({ where: { key }, update: {}, create: { key, value } });
  }

  // 分类法：分组 → 标签组 → 标签
  const algo = await prisma.category.upsert({
    where: { slug: "algorithm" },
    update: {},
    create: { name: "算法", slug: "algorithm", description: "算法与数据结构", order: 1 },
  });
  const sys = await prisma.category.upsert({
    where: { slug: "cs" },
    update: {},
    create: { name: "计算机基础", slug: "cs", description: "操作系统、网络、编译等", order: 2 },
  });

  const ds = await prisma.tagGroup.upsert({
    where: { slug: "data-structure" },
    update: {},
    create: { name: "数据结构", slug: "data-structure", categoryId: algo.id, order: 1 },
  });
  const dp = await prisma.tagGroup.upsert({
    where: { slug: "dynamic-programming" },
    update: {},
    create: { name: "动态规划", slug: "dynamic-programming", categoryId: algo.id, order: 2 },
  });
  const os = await prisma.tagGroup.upsert({
    where: { slug: "operating-system" },
    update: {},
    create: { name: "操作系统", slug: "operating-system", categoryId: sys.id, order: 1 },
  });

  const tagDefs: { name: string; group: string }[] = [
    { name: "二叉树", group: ds.id },
    { name: "平衡树", group: ds.id },
    { name: "线段树", group: ds.id },
    { name: "背包问题", group: dp.id },
    { name: "区间DP", group: dp.id },
    { name: "进程调度", group: os.id },
  ];
  const tags: Record<string, string> = {};
  for (const t of tagDefs) {
    const created = await prisma.tag.upsert({
      where: { name: t.name },
      update: {},
      create: { name: t.name, slug: slugify(t.name) + "-" + Math.random().toString(36).slice(2, 5), tagGroupId: t.group },
    });
    tags[t.name] = created.id;
  }

  // 示例文章
  const posts: {
    title: string;
    slug: string;
    content: string;
    excerpt: string;
    categoryId: string;
    tagNames: string[];
    daysAgo: number;
    views: number;
  }[] = [
    {
      title: "二叉树：从定义到遍历",
      slug: "binary-tree-basics",
      content: BINARY_TREE,
      excerpt: "二叉树是每个节点最多有两个子节点的树形结构，是算法学习中最基础也最重要的数据结构之一。",
      categoryId: algo.id,
      tagNames: ["二叉树"],
      daysAgo: 2,
      views: 342,
    },
    {
      title: "0-1 背包问题详解",
      slug: "knapsack-01",
      content:
        "0-1 背包是动态规划的入门经典。给定容量 $W$ 与 $n$ 件物品，每件有重量 $w_i$ 与价值 $v_i$，求最大价值。\n\n## 状态转移\n\n设 $dp[i][j]$ 为前 $i$ 件物品、容量 $j$ 的最大价值：\n\n$$dp[i][j] = \\max(dp[i-1][j],\\; dp[i-1][j-w_i] + v_i)$$\n\n```python\ndef knapsack(W, items):\n    dp = [0] * (W + 1)\n    for w, v in items:\n        for j in range(W, w - 1, -1):\n            dp[j] = max(dp[j], dp[j - w] + v)\n    return dp[W]\n```\n\n注意内层循环必须**逆序**，保证每件物品只被选一次。",
      excerpt: "0-1 背包是动态规划的入门经典，核心在于状态定义与逆序更新。",
      categoryId: algo.id,
      tagNames: ["背包问题"],
      daysAgo: 8,
      views: 211,
    },
    {
      title: "线段树入门：区间和与单点修改",
      slug: "segment-tree-intro",
      content:
        "线段树是一种支持区间查询与修改的树形结构，单次操作复杂度 $O(\\log n)$。\n\n## 建树\n\n```cpp\nvoid build(int p, int l, int r) {\n    if (l == r) { tree[p] = a[l]; return; }\n    int mid = (l + r) >> 1;\n    build(p << 1, l, mid);\n    build(p << 1 | 1, mid + 1, r);\n    tree[p] = tree[p << 1] + tree[p << 1 | 1];\n}\n```\n\n查询与修改沿树递归，每层只访问 $O(1)$ 个节点。",
      excerpt: "线段树支持 O(log n) 的区间查询与修改，是竞赛与工程中的常用结构。",
      categoryId: algo.id,
      tagNames: ["线段树"],
      daysAgo: 20,
      views: 156,
    },
    {
      title: "进程调度算法概览",
      slug: "process-scheduling",
      content:
        "操作系统通过调度算法决定 CPU 分配顺序。常见算法包括 FCFS、SJF、时间片轮转与多级反馈队列。\n\n## 平均周转时间\n\n$$T_{avg} = \\frac{1}{n}\\sum_{i=1}^{n}(t_{完成,i} - t_{到达,i})$$\n\n不同算法在响应时间与吞吐量之间各有取舍。",
      excerpt: "FCFS、SJF、时间片轮转、多级反馈队列——调度算法的核心权衡。",
      categoryId: sys.id,
      tagNames: ["进程调度"],
      daysAgo: 45,
      views: 98,
    },
  ];

  for (const p of posts) {
    const publishedAt = new Date();
    publishedAt.setDate(publishedAt.getDate() - p.daysAgo);
    await prisma.post.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        title: p.title,
        slug: p.slug,
        content: p.content,
        excerpt: p.excerpt,
        status: "PUBLISHED",
        viewCount: p.views,
        publishedAt,
        createdAt: publishedAt,
        authorId: admin.id,
        categoryId: p.categoryId,
        tags: { connect: p.tagNames.map((n) => ({ id: tags[n] })) },
      },
    });
  }
  console.log("示例文章就绪:", posts.length);

  // 公告
  const annCount = await prisma.announcement.count();
  if (annCount === 0) {
    await prisma.announcement.create({
      data: {
        content: "网站已上线，欢迎阅读算法与计算机技术笔记。",
        level: "info",
        active: true,
        authorId: admin.id,
      },
    });
  }

  // 传送门
  const portalCount = await prisma.portal.count();
  if (portalCount === 0) {
    await prisma.portal.createMany({
      data: [
        { title: "GitHub", url: "https://github.com", description: "我的代码仓库", group: "我的站点", placement: "sidebar", order: 1 },
        { title: "示例友链", url: "https://example.com", description: "一个朋友的博客", group: "友链", placement: "sidebar", order: 2 },
      ],
    });
  }

  // 全站访问趋势示例数据（近 30 天）
  const dvCount = await prisma.dailyView.count();
  if (dvCount === 0) {
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      await prisma.dailyView.create({
        data: { date, postId: null, count: Math.floor(20 + Math.random() * 80) },
      });
    }
  }

  console.log("Seed 完成。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
