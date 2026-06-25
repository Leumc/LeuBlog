import "server-only";
import { getSessionUser, type SessionUser } from "@/lib/auth";

/** 要求已登录，否则抛错（在 Server Action 中调用） */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("未登录");
  return user;
}

/** 要求管理员 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("需要管理员权限");
  return user;
}

/** 是否可编辑某文章：管理员全权；编者仅限本人文章 */
export function canEditPost(user: SessionUser, authorId: string): boolean {
  return user.role === "ADMIN" || user.id === authorId;
}

/** 后台导航板块（按角色裁剪）。EDITOR 只见「概览」「内容」 */
export type NavItem = { label: string; href: string; icon: string };
export type NavSection = { title: string; items: NavItem[] };

export function navForRole(role: SessionUser["role"]): NavSection[] {
  const overview: NavSection = {
    title: "概览",
    items: [{ label: "仪表盘", href: "/admin", icon: "▦" }],
  };
  if (role === "EDITOR") {
    return [
      overview,
      {
        title: "内容",
        items: [
          { label: "文章", href: "/admin/posts", icon: "✎" },
          { label: "写文章", href: "/admin/posts/new", icon: "＋" },
        ],
      },
    ];
  }
  return [
    overview,
    {
      title: "内容",
      items: [
        { label: "文章", href: "/admin/posts", icon: "✎" },
        { label: "写文章", href: "/admin/posts/new", icon: "＋" },
        { label: "分类法", href: "/admin/taxonomy", icon: "⌗" },
        { label: "媒体库", href: "/admin/media", icon: "◰" },
      ],
    },
    {
      title: "运营",
      items: [
        { label: "公告", href: "/admin/announcements", icon: "!" },
        { label: "传送门", href: "/admin/portals", icon: "↗" },
      ],
    },
    {
      title: "系统",
      items: [
        { label: "用户", href: "/admin/users", icon: "☺" },
        { label: "设置", href: "/admin/settings", icon: "⚙" },
      ],
    },
  ];
}

/** 仅管理员可访问的后台路径前缀（中间件 + 页面双重校验） */
export const ADMIN_ONLY_PREFIXES = [
  "/admin/announcements",
  "/admin/portals",
  "/admin/media",
  "/admin/taxonomy",
  "/admin/users",
  "/admin/settings",
];
