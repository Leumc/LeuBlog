"use client";

import { useState } from "react";
import { createAccessKey, updateAccessKey } from "@/app/admin/access-keys/actions";

export type AccessKeyInit = {
  id: string;
  label: string;
  secret: string;
  note: string;
  maxUses: string; // "" = 不限
  validUntil: string; // datetime-local 值，"" = 不过期
  active: boolean;
};

const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 去掉易混字符

function randomSecret(len = 10): string {
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => CHARSET[n % CHARSET.length]).join("");
}

export default function AccessKeyForm({ init }: { init?: AccessKeyInit }) {
  const editing = Boolean(init?.id);
  const [secret, setSecret] = useState(init?.secret ?? "");
  const [reveal, setReveal] = useState(false);

  return (
    <form action={editing ? updateAccessKey : createAccessKey} className="b">
      {editing && <input type="hidden" name="id" value={init!.id} />}

      <div className="fld" style={{ maxWidth: 420 }}>
        <label>备注名（可空）</label>
        <input name="label" defaultValue={init?.label ?? ""} placeholder="便于识别，如「内测读者」" />
      </div>

      <div className="fld" style={{ maxWidth: 520 }}>
        <label>密钥</label>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            name="secret"
            type={reveal ? "text" : "password"}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={editing ? "留空则不修改" : "自定义或点击生成"}
            autoComplete="off"
            style={{ flex: 1, minWidth: 200 }}
          />
          <button type="button" className="btn sm" onClick={() => setReveal((r) => !r)}>
            {reveal ? "隐藏" : "显示"}
          </button>
          <button type="button" className="btn sm" onClick={() => { setSecret(randomSecret()); setReveal(true); }}>
            生成
          </button>
        </div>
      </div>

      <div className="fld" style={{ maxWidth: 520 }}>
        <label>密钥说明（解锁成功后展示，可空）</label>
        <textarea name="note" defaultValue={init?.note ?? ""} rows={2} />
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div className="fld">
          <label>最大使用次数（空=不限）</label>
          <input name="maxUses" type="number" min="1" defaultValue={init?.maxUses ?? ""} style={{ width: 140 }} />
        </div>
        <div className="fld">
          <label>有效截止（空=不过期）</label>
          <input name="validUntil" type="datetime-local" defaultValue={init?.validUntil ?? ""} />
        </div>
        <div className="fld">
          <label>状态</label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, paddingTop: 6 }}>
            <input type="checkbox" name="active" defaultChecked={init ? init.active : true} />
            启用
          </label>
        </div>
      </div>

      <button type="submit" className="btn primary sm" style={{ marginTop: 10 }}>
        {editing ? "保存修改" : "创建密钥"}
      </button>
    </form>
  );
}
