"use client";

import { useActionState, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { loginAction, type LoginState } from "../auth-actions";

function LoginForm() {
  const params = useSearchParams();
  const from = params.get("from") || "/admin";
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const [show, setShow] = useState(false);

  return (
    <div className="login-body dotgrid">
      <div className="topbar" />
      <div className="login-center">
        <div className="login-box">
          <div className="login-brand">
            <div className="kicker">Admin · 后台登录</div>
            <h1>LeuBlog</h1>
            <div className="sub">算法学习记录 与 计算机技术教程</div>
          </div>

          {state.error && <div className="err">⚠ {state.error}</div>}

          <form action={action}>
            <input type="hidden" name="from" value={from} />
            <div className="fld">
              <label>用户名 / 邮箱</label>
              <input
                type="text"
                name="identifier"
                placeholder="leu 或 leu@example.com"
                autoComplete="username"
                autoFocus
              />
            </div>
            <div className="fld">
              <label>密码</label>
              <div className="pw">
                <input
                  type={show ? "text" : "password"}
                  name="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button type="button" className="eye" onClick={() => setShow((v) => !v)}>
                  {show ? "隐藏" : "显示"}
                </button>
              </div>
            </div>
            <div className="login-row">
              <label>
                <input type="checkbox" name="remember" defaultChecked /> 记住我（30 天）
              </label>
            </div>
            <button className="submit" type="submit" disabled={pending}>
              {pending ? "登录中…" : "登 录"}
            </button>
          </form>

          <div className="hint">
            <span className="lock">🔒 本站不开放公开注册</span>
            <br />
            仅<b>编者</b>与<b>管理员</b>可登录。需要账号请联系站点管理员。
            <br />
            <a href="/">← 返回站点首页</a>
          </div>
        </div>
      </div>
      <div className="login-footer">LeuBlog · © 2024–{new Date().getFullYear()} · 由 Next.js 与衬线字体驱动</div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
