"use client";

import { useState } from "react";
import { ACCENT_PRESETS } from "@/lib/appearance";

/** 强调色选择：预设（砖红/墨绿/靛蓝）+ 自定义取色，提交时写入隐藏 input */
export default function AccentPicker({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial.toLowerCase());
  const isPreset = ACCENT_PRESETS.some((p) => p.value === value);

  return (
    <div className="fld">
      <label>默认强调色</label>
      <div className="colorrow" style={{ flexWrap: "wrap", gap: 10 }}>
        {ACCENT_PRESETS.map((p) => (
          <button
            type="button"
            key={p.value}
            onClick={() => setValue(p.value)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              border: value === p.value ? "2px solid var(--aink)" : "1px solid var(--aline)",
              background: "#fff",
              borderRadius: 7,
              padding: "4px 10px",
              cursor: "pointer",
              fontSize: 12.5,
            }}
          >
            <span className="swatch" style={{ background: p.value, width: 18, height: 18 }} />
            {p.name}
          </button>
        ))}
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            border: !isPreset ? "2px solid var(--aink)" : "1px solid var(--aline)",
            borderRadius: 7,
            padding: "4px 10px",
            cursor: "pointer",
            fontSize: 12.5,
          }}
        >
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#9c2b22"}
            onChange={(e) => setValue(e.target.value)}
            style={{ width: 22, height: 22, border: "none", padding: 0, background: "none" }}
          />
          自定义
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            style={{ width: 84, border: "1px solid var(--aline)", borderRadius: 6, padding: "3px 6px", fontSize: 12 }}
          />
        </label>
      </div>
      <span className="hint">
        站点默认强调色；读者可在前台用切换器本地覆盖（存浏览器 localStorage）。
      </span>
      <input type="hidden" name="appearance.accent" value={value} />
    </div>
  );
}
