import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import CreateEditorForm from "./CreateEditorForm";
import { toggleUserActive, resetPassword, deleteUser } from "./actions";

export default async function UsersPage() {
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { posts: true } } },
  });

  return (
    <div className="max-w-4xl">
      <h1 className="mb-1 font-serif text-2xl font-bold text-neutral-900">用户</h1>
      <p className="mb-5 text-sm text-neutral-500">
        管理员全站唯一，只能创建/管理编者。读者无需账号。
      </p>

      <CreateEditorForm />

      <div className="overflow-x-auto bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wider text-neutral-500">
              <th className="px-4 py-2">用户名</th>
              <th className="px-4 py-2">显示名</th>
              <th className="px-4 py-2">角色</th>
              <th className="px-4 py-2">文章</th>
              <th className="px-4 py-2">状态</th>
              <th className="px-4 py-2">创建</th>
              <th className="px-4 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-neutral-100">
                <td className="px-4 py-2.5 font-medium">{u.username}</td>
                <td className="px-4 py-2.5 text-neutral-600">{u.displayName}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[11px] ${
                      u.role === "ADMIN"
                        ? "bg-accent/10 text-accent"
                        : "bg-neutral-200 text-neutral-600"
                    }`}
                  >
                    {u.role === "ADMIN" ? "管理员" : "编者"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-neutral-600">{u._count.posts}</td>
                <td className="px-4 py-2.5">
                  {u.role === "ADMIN" ? (
                    <span className="text-neutral-400">—</span>
                  ) : (
                    <form action={toggleUserActive}>
                      <input type="hidden" name="id" value={u.id} />
                      <button
                        className={`rounded px-2 py-0.5 text-xs ${
                          u.active
                            ? "bg-green-100 text-green-700"
                            : "bg-neutral-200 text-neutral-500"
                        }`}
                      >
                        {u.active ? "启用中" : "已禁用"}
                      </button>
                    </form>
                  )}
                </td>
                <td className="px-4 py-2.5 text-neutral-500">{formatDate(u.createdAt)}</td>
                <td className="px-4 py-2.5 text-right">
                  {u.role === "ADMIN" ? (
                    <span className="text-neutral-300">—</span>
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      <form action={resetPassword} className="flex items-center gap-1">
                        <input type="hidden" name="id" value={u.id} />
                        <input
                          name="password"
                          placeholder="新密码"
                          className="w-24 border border-neutral-300 px-1.5 py-0.5 text-xs"
                        />
                        <button className="text-xs text-accent hover:underline">重置</button>
                      </form>
                      {u._count.posts === 0 && (
                        <form action={deleteUser}>
                          <input type="hidden" name="id" value={u.id} />
                          <button className="text-xs text-neutral-400 hover:text-accent">
                            删除
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
