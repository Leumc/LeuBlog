"use client";

import { useEffect, useState } from "react";
import { ACCENT_PRESETS, DEFAULT_ACCENT, isValidHex } from "@/lib/appearance";

const KEY = "leublog:accent";
const PRESET_VALUES: string[] = ACCENT_PRESETS.map((p) => p.value);

/** 读者侧强调色切换器：选择存 localStorage，覆盖后台默认值 */
export default function AccentSwitcher({ defaultAccent }: { defaultAccent: string }) {
  const [accent, setAccent] = useState<string>(defaultAccent);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem(KEY);
    if (saved && isValidHex(saved)) {
      const v = saved.toLowerCase();
      setAccent(v);
      document.documentElement.style.setProperty("--accent", v);
    }
  }, []);

  const apply = (v: string) => {
    const val = isValidHex(v) ? v.toLowerCase() : DEFAULT_ACCENT;
    setAccent(val);
    localStorage.setItem(KEY, val);
    document.documentElement.style.setProperty("--accent", val);
  };

  if (!mounted) return null;
  const isPreset = PRESET_VALUES.includes(accent);

  return (
    <div className="accent-switcher">
      <button
        type="button"
        className="as-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-label="切换强调色"
        title="强调色"
      >
        <span className="as-dot" style={{ background: accent }} />
        强调色
      </button>
      {open && (
        <div className="as-pop">
          <div className="as-presets">
            {ACCENT_PRESETS.map((p) => (
              <button
                type="button"
                key={p.value}
                className={`as-opt${accent === p.value ? " on" : ""}`}
                onClick={() => {
                  apply(p.value);
                  setOpen(false);
                }}
              >
                <span className="as-dot" style={{ background: p.value }} />
                {p.name}
              </button>
            ))}
          </div>
          <label className="as-custom">
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(accent) ? accent : DEFAULT_ACCENT}
              onChange={(e) => apply(e.target.value)}
            />
            <span>{isPreset ? "自定义" : accent}</span>
          </label>
          <button
            type="button"
            className="as-reset"
            onClick={() => {
              localStorage.removeItem(KEY);
              setAccent(defaultAccent);
              document.documentElement.style.setProperty("--accent", defaultAccent);
              setOpen(false);
            }}
          >
            恢复站点默认
          </button>
        </div>
      )}
    </div>
  );
}
