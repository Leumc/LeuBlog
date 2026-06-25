import { getSettings } from "@/lib/settings";
import { saveSettings } from "./actions";
import AccentPicker from "./AccentPicker";

function Field({
  name,
  label,
  value,
  textarea,
  rows,
  hint,
  width,
}: {
  name: string;
  label: string;
  value: string;
  textarea?: boolean;
  rows?: number;
  hint?: string;
  width?: number;
}) {
  return (
    <div className="fld">
      <label>{label}</label>
      {textarea ? (
        <textarea name={name} defaultValue={value} rows={rows ?? 4} />
      ) : (
        <input name={name} defaultValue={value} style={width ? { width } : undefined} />
      )}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export default async function SettingsPage() {
  const s = await getSettings();

  return (
    <>
      <div className="row2">
        <div className="panel">
          <div className="h">
            <h2>站点信息（报头三行）</h2>
          </div>
          <div className="b">
            <form action={saveSettings}>
              <Field name="masthead.kicker" label="上标 Kicker" value={s["masthead.kicker"]} />
              <Field name="masthead.title" label="站点标题" value={s["masthead.title"]} />
              <Field name="masthead.subtitle" label="副标题" value={s["masthead.subtitle"]} />
              <Field name="home.postCount" label="首页文章数" value={s["home.postCount"]} width={90} />
              <button className="btn primary">保存</button>
            </form>
          </div>
        </div>

        <div className="panel">
          <div className="h">
            <h2>外观</h2>
          </div>
          <div className="b">
            <form action={saveSettings}>
              <AccentPicker initial={s["appearance.accent"]} />
              <div className="fld">
                <label>背景纸色</label>
                <div className="colorrow">
                  <span className="swatch" style={{ background: "#faf7f1" }} />
                  <input name="appearance.paper" defaultValue={s["appearance.paper"]} style={{ width: 120 }} />
                </div>
              </div>
              <div className="fld">
                <label>传送门默认展示位置</label>
                <input name="portal.placement" defaultValue={s["portal.placement"]} />
                <span className="hint">sidebar 或 footer</span>
              </div>
              <button className="btn primary">保存</button>
            </form>
          </div>
        </div>
      </div>

      <div className="row2">
        <div className="panel">
          <div className="h">
            <h2>关于页内容（Markdown）</h2>
          </div>
          <div className="b">
            <form action={saveSettings}>
              <Field name="about.content" label="正文" value={s["about.content"]} textarea rows={6} hint="前台「关于」页将渲染这段 Markdown。" />
              <button className="btn primary">保存</button>
            </form>
          </div>
        </div>

        <div className="panel">
          <div className="h">
            <h2>联系方式 / Colophon</h2>
          </div>
          <div className="b">
            <form action={saveSettings}>
              <Field name="about.contact" label="联系方式" value={s["about.contact"]} />
              <Field name="about.colophon" label="Colophon（页脚说明）" value={s["about.colophon"]} />
              <button className="btn primary">保存</button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
