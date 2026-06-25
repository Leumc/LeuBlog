import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || "admin@leublog.local").toLowerCase();
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "changeme123";
  const displayName = process.env.ADMIN_DISPLAY_NAME || "站长";

  // 唯一管理员（幂等：已存在则只确保角色为 ADMIN，不覆盖密码/资料）
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
      bio: "本站站长。",
    },
  });
  console.log("管理员就绪:", admin.username);

  // 站点设置（仅在缺失时创建，不覆盖后台已改的值）
  const settings: Record<string, string> = {
    "site.name": process.env.SITE_NAME || "LeuBlog",
    "site.subtitle": "算法学习记录 与 计算机技术教程",
    "masthead.kicker": "Algorithms · Computer Science · Notes",
    "masthead.title": process.env.SITE_NAME || "LeuBlog",
    "masthead.subtitle": "算法学习记录 与 计算机技术教程",
    "home.postCount": "8",
    "portal.placement": "sidebar",
    "appearance.accent": "#9c2b22",
    "appearance.paper": "#faf7f1",
    "about.content":
      "# 关于本站\n\n这里记录算法学习与计算机技术笔记。内容可在后台「设置」中修改。",
    "about.contact": "邮箱：" + email,
    "about.colophon": "由 Next.js + SQLite + Prisma 构建，部署于轻量 VPS。",
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.siteSetting.upsert({ where: { key }, update: {}, create: { key, value } });
  }
  console.log("站点设置就绪。");

  console.log("Seed 完成（仅管理员 + 站点设置，无示例内容）。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
