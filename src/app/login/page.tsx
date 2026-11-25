"use client";
import { useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Layers3,
  ShieldCheck,
  ChartNoAxesCombined,
} from "lucide-react";
import Brand from "@/components/brand";
import { AppearanceControl } from "@/components/appearance";
export default function Login() {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [show, setShow] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
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
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      window.location.assign("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể kết nối");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-v2">
      <section className="login-visual">
        <Brand />
        <div className="login-art" aria-hidden="true">
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <div className="art-orbit orbit-three" />
          <div className="art-center">
            <Layers3 size={62} strokeWidth={1} />
          </div>
          <div className="art-tag art-tag-one">
            <ChartNoAxesCombined size={19} />
            <span>Nội dung tạo giá trị</span>
          </div>
          <div className="art-tag art-tag-two">
            <ShieldCheck size={19} />
            <span>Kết nối đội ngũ</span>
          </div>
        </div>
        <div className="login-manifesto">
          <span>AVORA · CONTENT WORKSPACE</span>
          <h1>
            Mỗi ý tưởng.
            <br />
            Một bước tiến.
          </h1>
          <p>Không gian chung cho nội dung và đội ngũ của bạn.</p>
        </div>
        <small className="login-visual-foot">
          CREATE TOGETHER. GROW TOGETHER.
        </small>
      </section>
      <section className="login-access">
        <div className="login-v2-appearance">
          <AppearanceControl />
        </div>
        <div className="login-mobile-brand">
          <Brand />
        </div>
        <form className="login-card" onSubmit={submit}>
          <span className="login-overline">CHÀO MỪNG TRỞ LẠI</span>
          <h2>Đăng nhập</h2>
          <p>Tiếp tục công việc cùng AVORA MEDIA.</p>
          <label htmlFor="login-email">Email công ty</label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            placeholder="ban@congty.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label htmlFor="login-password">Mật khẩu</label>
          <div className="login-password">
            <input
              id="login-password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Nhập mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              onClick={() => setShow(!show)}
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <div className="login-error" role="status">
            {error}
          </div>
          <button className="btn primary full" disabled={busy}>
            {busy ? "Đang đăng nhập…" : "Đăng nhập"}
            <ArrowRight size={17} />
          </button>
          <small>
            <ShieldCheck size={13} /> Không gian nội bộ AVORA MEDIA
          </small>
        </form>
        <span className="login-access-foot">AVORA MEDIA © 2026</span>
      </section>
    </main>
  );
}
