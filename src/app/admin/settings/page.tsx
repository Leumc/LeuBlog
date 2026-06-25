import { getSettings } from "@/lib/settings";
import { saveSettings } from "./actions";

function Field({
  name,
  label,
  value,
  textarea,
  rows,
}: {
  name: string;
  label: string;
  value: string;
  textarea?: boolean;
  rows?: number;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs uppercase tracking-wider text-neutral-500">
        {label}
      </label>
      {textarea ? (
        <textarea
          name={name}
          defaultValue={value}
          rows={rows ?? 4}
          className="w-full border border-neutral-300 px-2 py-1.5 outline-none focus:border-accent"
        />
      ) : (
        <input
          name={name}
          defaultValue={value}
          className="w-full border border-neutral-300 px-2 py-1.5 outline-none focus:border-accent"
        />
      )}
    </div>
  );
}

export default async function SettingsPage() {
  const s = await getSettings();

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 font-serif text-2xl font-bold text-neutral-900">设置</h1>
      <p className="mb-5 text-sm text-neutral-500">站点信息、报头文案、关于页内容。</p>

      <form action={saveSettings} className="space-y-6">
        <section className="space-y-3 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-600">
            站点
          </h2>
          <Field name="site.name" label="站点名称" value={s["site.name"]} />
          <Field name="site.subtitle" label="副标题" value={s["site.subtitle"]} />
          <Field name="home.postCount" label="首页文章数" value={s["home.postCount"]} />
        </section>

        <section className="space-y-3 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-600">
            报头（首页顶部三行）
          </h2>
          <Field name="masthead.kicker" label="上标（kicker）" value={s["masthead.kicker"]} />
          <Field name="masthead.title" label="主标题" value={s["masthead.title"]} />
          <Field name="masthead.subtitle" label="副标题" value={s["masthead.subtitle"]} />
        </section>

        <section className="space-y-3 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-600">
            关于页
          </h2>
          <Field name="about.content" label="正文（Markdown）" value={s["about.content"]} textarea rows={8} />
          <Field name="about.contact" label="联系方式" value={s["about.contact"]} />
          <Field name="about.colophon" label="Colophon（页脚说明）" value={s["about.colophon"]} />
        </section>

        <button className="bg-accent px-5 py-2.5 text-white hover:bg-accent-2">
          保存设置
        </button>
      </form>
    </div>
  );
}
