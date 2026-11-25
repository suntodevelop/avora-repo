"use client";
import { useState } from "react";
import { Activity, ArrowUpRight, Eye, EyeOff } from "lucide-react";
export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error);
      window.location.assign("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể kết nối");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login">
      <div className="login-story">
        <div className="brand">
          <span className="brand-mark">
            <Activity size={24} />
          </span>
          MediaPulse<span className="brand-dot">.</span>
        </div>
        <div>
          <div className="eyebrow">YOUR CONTENT. YOUR IMPACT.</div>
          <h1>
            Mỗi bài đăng.
            <br />
            Một bước tiến.
          </h1>
          <p>
            Một không gian để đội ngũ của bạn theo dõi nội dung,
            <br />
            hiểu hiệu suất và cùng nhau phát triển.
          </p>
          <div className="login-chart">
            {[38, 62, 46, 81, 58, 72, 95, 68, 87, 100, 80, 115].map((h, i) => (
              <span key={i} style={{ height: h }} />
            ))}
          </div>
        </div>
        <span className="login-foot">
          Không gian làm việc dành cho đội ngũ Media <ArrowUpRight size={16} />
        </span>
      </div>
      <div className="login-form">
        <form onSubmit={submit}>
          <span className="pill">WORKSPACE</span>
          <h2>Chào mừng trở lại</h2>
          <p>Đăng nhập để xem nhịp hoạt động của đội ngũ.</p>
          <label>
            Email công ty
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ban@congty.com"
              required
              autoComplete="username"
            />
          </label>
          <label>
            Mật khẩu
            <div className="password">
              <input
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu của bạn"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                aria-label="Hiện mật khẩu"
                onClick={() => setShow(!show)}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
          <button className="btn primary full" disabled={busy}>
            {busy ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
          <div className="demo-login">
            <strong>Trải nghiệm bản demo</strong>
            <p>Tài khoản mẫu để trải nghiệm. Mật khẩu: Demo@12345</p>
            <div>
              <button
                type="button"
                onClick={() => {
                  setEmail("admin@media.local");
                  setPassword("Demo@12345");
                }}
              >
                Tài khoản Admin
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail("nv1@media.local");
                  setPassword("Demo@12345");
                }}
              >
                Tài khoản Nhân viên
              </button>
            </div>
          </div>
          <small>
            MediaPulse © {new Date().getFullYear()} · Internal workspace
          </small>
        </form>
      </div>
    </div>
  );
}
