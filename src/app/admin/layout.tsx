import { getSessionUser } from "@/lib/auth";
import { navForRole } from "@/lib/permissions";
import AdminShell from "@/components/admin/AdminShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  // 未登录（登录页）：不渲染后台外壳
  if (!user) return <>{children}</>;

  return (
    <AdminShell
      sections={navForRole(user.role)}
      user={{ displayName: user.displayName, role: user.role }}
    >
      {children}
    </AdminShell>
  );
}
