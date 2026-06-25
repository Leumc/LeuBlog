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
    <div className="max-w-4xl">
      <h1 className="mb-1 font-serif text-2xl font-bold text-neutral-900">传送门</h1>
      <p className="mb-5 text-sm text-neutral-500">
        外链（友链 / 我的其他站点），可设置展示在侧栏或页脚。
      </p>

      <form
        action={setPlacementPref}
        className="mb-6 flex items-center gap-3 bg-white p-4 text-sm shadow-sm"
      >
        <span className="text-neutral-600">前台展示位置：</span>
        <select name="placement" defaultValue={placement} className="border border-neutral-300 px-2 py-1.5">
          <option value="sidebar">侧栏</option>
          <option value="footer">页脚</option>
        </select>
        <button className="bg-neutral-800 px-3 py-1.5 text-white hover:bg-neutral-700">
          保存位置
        </button>
      </form>

      <form
        action={createPortal}
        className="mb-8 grid grid-cols-1 gap-3 bg-white p-5 text-sm shadow-sm sm:grid-cols-2"
      >
        <input name="title" placeholder="标题" required className="border border-neutral-300 px-2 py-1.5" />
        <input name="url" placeholder="https://" required className="border border-neutral-300 px-2 py-1.5" />
        <input name="description" placeholder="描述（可空）" className="border border-neutral-300 px-2 py-1.5" />
        <input name="group" placeholder="分组（如 友链 / 我的站点）" defaultValue="友链" className="border border-neutral-300 px-2 py-1.5" />
        <select name="placement" className="border border-neutral-300 px-2 py-1.5">
          <option value="sidebar">侧栏</option>
          <option value="footer">页脚</option>
        </select>
        <input name="order" type="number" placeholder="排序（数字越小越靠前）" defaultValue={0} className="border border-neutral-300 px-2 py-1.5" />
        <div className="sm:col-span-2">
          <button className="bg-accent px-4 py-2 text-white hover:bg-accent-2">添加传送门</button>
        </div>
      </form>

      <div className="overflow-x-auto bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wider text-neutral-500">
              <th className="px-4 py-2">标题</th>
              <th className="px-4 py-2">分组</th>
              <th className="px-4 py-2">位置</th>
              <th className="px-4 py-2">排序</th>
              <th className="px-4 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {portals.map((p) => (
              <tr key={p.id} className="border-b border-neutral-100">
                <td className="px-4 py-2.5">
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
                    {p.title}
                  </a>
                  {p.description && (
                    <span className="block text-xs text-neutral-400">{p.description}</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-neutral-600">{p.group}</td>
                <td className="px-4 py-2.5 text-neutral-600">
                  {p.placement === "footer" ? "页脚" : "侧栏"}
                </td>
                <td className="px-4 py-2.5 text-neutral-600">{p.order}</td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-3">
                    <form action={togglePortal}>
                      <input type="hidden" name="id" value={p.id} />
                      <button
                        className={`rounded px-2 py-0.5 text-xs ${
                          p.visible ? "bg-green-100 text-green-700" : "bg-neutral-200 text-neutral-500"
                        }`}
                      >
                        {p.visible ? "显示中" : "已隐藏"}
                      </button>
                    </form>
                    <form action={deletePortal}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="text-neutral-400 hover:text-accent">删除</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {portals.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center italic text-neutral-400">
                  暂无传送门
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
