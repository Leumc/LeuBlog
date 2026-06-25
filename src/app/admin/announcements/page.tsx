import { prisma } from "@/lib/prisma";
import { createAnnouncement, toggleAnnouncement, deleteAnnouncement } from "./actions";

function fmtRange(s: Date | null, e: Date | null): string {
  const d = (x: Date) => `${String(x.getMonth() + 1).padStart(2, "0")}/${String(x.getDate()).padStart(2, "0")}`;
  if (!s && !e) return "永久";
  return `${s ? d(s) : "即时"} – ${e ? d(e) : "永久"}`;
}

export default async function AnnouncementsPage() {
  const list = await prisma.announcement.findMany({ orderBy: { createdAt: "desc" } });
  const now = Date.now();

  return (
    <div className="row2">
      <div className="panel">
        <div className="h">
          <h2>公告列表</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>内容</th>
              <th>级别</th>
              <th>时效</th>
              <th>状态</th>
              <th style={{ width: 120 }} />
            </tr>
          </thead>
          <tbody>
            {list.map((a) => {
              const expired = a.endsAt ? a.endsAt.getTime() < now : false;
              const showing = a.active && !expired && (!a.startsAt || a.startsAt.getTime() <= now);
              return (
                <tr key={a.id}>
                  <td className="ttl">{a.content}</td>
                  <td>
                    <span className={`pill ${a.level === "warn" ? "warn" : "blue"}`}>
                      {a.level === "warn" ? "提示" : "通知"}
                    </span>
                  </td>
                  <td className="sub2">{fmtRange(a.startsAt, a.endsAt)}</td>
                  <td>
                    <span className={`status ${showing ? "pub" : "draft"}`}>
                      {showing ? "展示中" : expired ? "已过期" : "已停用"}
                    </span>
                  </td>
                  <td>
                    <div className="acts">
                      <form action={toggleAnnouncement}>
                        <input type="hidden" name="id" value={a.id} />
                        <button className="lk">{a.active ? "下线" : "上线"}</button>
                      </form>
                      <form action={deleteAnnouncement}>
                        <input type="hidden" name="id" value={a.id} />
                        <button className="lk del">删除</button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "var(--amuted)" }}>
                  暂无公告
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <div className="h">
          <h2>新建公告</h2>
        </div>
        <div className="b">
          <form action={createAnnouncement}>
            <div className="fld">
              <label>内容</label>
              <textarea name="content" rows={3} placeholder="一句话公告，简短为宜" required />
            </div>
            <div className="grid2">
              <div className="fld">
                <label>级别</label>
                <select name="level">
                  <option value="info">通知</option>
                  <option value="warn">提示</option>
                </select>
              </div>
              <div className="fld">
                <label>状态</label>
                <input value="新建即展示" disabled />
              </div>
            </div>
            <div className="grid2">
              <div className="fld">
                <label>开始时间（可空）</label>
                <input type="datetime-local" name="startsAt" />
              </div>
              <div className="fld">
                <label>结束时间（可空）</label>
                <input type="datetime-local" name="endsAt" />
              </div>
            </div>
            <button className="btn primary">保存公告</button>
          </form>
        </div>
      </div>
    </div>
  );
}
