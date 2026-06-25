import { prisma } from "@/lib/prisma";
import { getSetting, setSetting } from "@/lib/settings";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/permissions";
import { createPortal, togglePortal, deletePortal } from "./actions";

async function setPlacementPref(formData: FormData) {
  "use server";
  await requireAdmin();
  const v = formData.get("placement") === "footer" ? "footer" : "sidebar";
  await setSetting("portal.placement", v);
  revalidatePath("/admin/portals");
  revalidatePath("/");
}

export default async function PortalsPage() {
  const [portals, placement] = await Promise.all([
    prisma.portal.findMany({ orderBy: [{ placement: "asc" }, { order: "asc" }] }),
    getSetting("portal.placement"),
  ]);

  return (
    <div className="panel">
      <div className="h">
        <h2>传送门 / 外链</h2>
        <span className="right" style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--soft)" }}>
          默认位置：
        </span>
        <form action={setPlacementPref} style={{ display: "inline-flex" }}>
          <div className="seg">
            <button type="submit" name="placement" value="sidebar" className={placement === "sidebar" ? "on" : ""}>
              侧栏
            </button>
            <button type="submit" name="placement" value="footer" className={placement === "footer" ? "on" : ""}>
              页脚
            </button>
          </div>
        </form>
      </div>
      <table>
        <thead>
          <tr>
            <th>标题 / 描述</th>
            <th>链接</th>
            <th>分组</th>
            <th>展示位置</th>
            <th>显示</th>
            <th style={{ width: 110 }} />
          </tr>
        </thead>
        <tbody>
          {portals.map((p) => (
            <tr key={p.id}>
              <td>
                <div className="ttl">{p.title}</div>
                {p.description && <div className="sub2">{p.description}</div>}
              </td>
              <td className="sub2">{p.url.replace(/^https?:\/\//, "")}</td>
              <td>
                <span className="tag">{p.group}</span>
              </td>
              <td>
                <span className="pill muted">{p.placement === "footer" ? "页脚" : "侧栏"}</span>
              </td>
              <td>
                <form action={togglePortal}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className={`switch${p.visible ? " on" : ""}`} aria-label="切换显示" />
                </form>
              </td>
              <td>
                <div className="acts">
                  <form action={deletePortal}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="lk del">删除</button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
          {portals.length === 0 && (
            <tr>
              <td colSpan={6} style={{ textAlign: "center", color: "var(--amuted)" }}>
                暂无传送门
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="b" style={{ borderTop: "1px solid var(--aline)" }}>
        <form action={createPortal} className="grid2">
          <div className="fld">
            <label>标题</label>
            <input name="title" placeholder="如：我的实验室" required />
          </div>
          <div className="fld">
            <label>链接</label>
            <input name="url" placeholder="https://" required />
          </div>
          <div className="fld">
            <label>描述（可空）</label>
            <input name="description" placeholder="一句话说明" />
          </div>
          <div className="fld">
            <label>分组</label>
            <input name="group" placeholder="如 友链 / 我的站点" defaultValue="友链" />
          </div>
          <div className="fld">
            <label>展示位置</label>
            <select name="placement">
              <option value="sidebar">侧栏</option>
              <option value="footer">页脚</option>
            </select>
          </div>
          <div className="fld">
            <label>排序</label>
            <input name="order" type="number" defaultValue={0} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <button className="btn primary">＋ 新增链接</button>
          </div>
        </form>
      </div>
    </div>
  );
}
