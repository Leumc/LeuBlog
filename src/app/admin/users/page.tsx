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
    <>
      <div className="note">
        系统<b>仅允许一个管理员</b>。管理员可创建/禁用编者、重置密码；编者只能管理自己的文章。
      </div>

      <CreateEditorForm />

      <div className="panel">
        <div className="h">
          <h2>用户</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>用户</th>
              <th>角色</th>
              <th>邮箱</th>
              <th className="num">文章</th>
              <th>状态</th>
              <th>加入时间</th>
              <th style={{ width: 200 }} />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="ttl">{u.displayName}</td>
                <td>
                  <span className={`pill ${u.role === "ADMIN" ? "admin" : "muted"}`}>
                    {u.role === "ADMIN" ? "管理员" : "编者"}
                  </span>
                </td>
                <td className="sub2">{u.email}</td>
                <td className="num">{u._count.posts}</td>
                <td>
                  <span className={`status ${u.active ? "pub" : "draft"}`}>
                    {u.active ? "正常" : "已禁用"}
                  </span>
                </td>
                <td className="sub2">{formatDate(u.createdAt).replace(/^\d+ 年 /, "")}</td>
                <td>
                  <div className="acts">
                    {u.role === "ADMIN" ? (
                      <span className="sub2">—</span>
                    ) : (
                      <>
                        <form action={resetPassword} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <input type="hidden" name="id" value={u.id} />
                          <input
                            name="password"
                            placeholder="重置密码"
                            style={{ width: 80, fontSize: 11.5, border: "1px solid var(--aline)", borderRadius: 6, padding: "4px 6px" }}
                          />
                          <button className="lk">重置</button>
                        </form>
                        <form action={toggleUserActive}>
                          <input type="hidden" name="id" value={u.id} />
                          <button className="lk del">{u.active ? "禁用" : "启用"}</button>
                        </form>
                        {u._count.posts === 0 && (
                          <form action={deleteUser}>
                            <input type="hidden" name="id" value={u.id} />
                            <button className="lk del">删除</button>
                          </form>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
