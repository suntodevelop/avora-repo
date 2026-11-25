"use client";
import { useEffect, useMemo, useState } from "react";
// Use ordinary navigation on the Worker build. This avoids the beta runtime's
// RSC prefetch path while retaining browser history and accessible links.
function Link(props: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} />;
}
import {
  Activity,
  LayoutDashboard,
  FileText,
  Users,
  Settings2,
  LogOut,
  RefreshCw,
  Download,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
  X,
  ExternalLink,
  TrendingUp,
  MessageCircle,
  Heart,
  Share2,
  Clock3,
  CalendarDays,
  MoreHorizontal,
  CheckCircle2,
  Info,
  Shield,
  Pencil,
  Trash2,
  SlidersHorizontal,
  Flag as Facebook,
} from "lucide-react";
import type { Snapshot, Post } from "@/lib/types";
import { todayVN, shiftDay, engagement } from "@/lib/time";
import { employeeReport, filteredPosts } from "@/lib/report";
const num = (n: number) => new Intl.NumberFormat("vi-VN").format(n);
const colors = ["mint", "blue", "violet", "orange"];
const initials = (name: string) =>
  name
    .split(" ")
    .slice(-2)
    .map((s) => s[0])
    .join("");
type FormState = {
  kind: "user" | "page" | "review";
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  password?: string;
  facebookUserId?: string;
  url?: string;
  token?: string;
  source?: string;
  employeeIds?: string[];
  status?: string;
  note?: string;
  employeeId?: string;
};
export default function Workspace({
  section,
}: {
  section: "dashboard" | "posts" | "admin";
}) {
  const [data, setData] = useState<Snapshot>();
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [preset, setPreset] = useState("7days");
  const [from, setFrom] = useState(shiftDay(todayVN(), -6));
  const [to, setTo] = useState(todayVN());
  const [employee, setEmployee] = useState("");
  const [page, setPage] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const [pagination, setPagination] = useState(1);
  const [tab, setTab] = useState("pages");
  const [form, setForm] = useState<FormState | null>(null);
  const [deletion, setDeletion] = useState<{
    action: string;
    id: string;
    name: string;
  } | null>(null);
  async function load() {
    try {
      const response = await fetch("/api/data", { cache: "no-store" });
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }
      const result = (await response.json()) as Snapshot & { error?: string };
      if (!response.ok) throw new Error(result.error);
      setData(result);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải dữ liệu");
    }
  }
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get("from") && query.get("to")) {
      setFrom(query.get("from")!);
      setTo(query.get("to")!);
      setPreset("custom");
    }
    if (query.get("employee")) setEmployee(query.get("employee")!);
    if (query.get("page")) setPage(query.get("page")!);
    void load();
  }, []);
  useEffect(() => {
    setPagination(1);
  }, [from, to, employee, page, query, sort]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 6000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  async function mutate(body: unknown) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as {
        error?: string;
        results?: {
          page: string;
          success: boolean;
          count: number;
          error?: string;
        }[];
      };
      if (!response.ok) throw new Error(result.error);
      await load();
      setToast(
        result.results
          ? result.results
              .map(
                (r: {
                  page: string;
                  success: boolean;
                  count: number;
                  error?: string;
                }) =>
                  `${r.page}: ${r.success ? `${r.count} bài đã đồng bộ` : r.error}`,
              )
              .join(" · ")
          : "Đã lưu thay đổi",
      );
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Thao tác thất bại");
      return false;
    } finally {
      setBusy(false);
    }
  }
  const params = useMemo(
    () =>
      new URLSearchParams({
        from,
        to,
        ...(employee ? { employee } : {}),
        ...(page ? { page } : {}),
      }),
    [from, to, employee, page],
  );
  const posts = data ? filteredPosts(data, params) : [];
  const report = data ? employeeReport(data, params) : [];
  const total = posts.reduce((s, p) => s + engagement(p), 0);
  const hours = Array.from({ length: 24 }, (_, h) => ({
    h,
    count: posts.filter((p) => p.postHour === h).length,
  })).sort((a, b) => b.count - a.count);
  const top = report.find((r) => r.posts > 0);
  const displayPosts = [...posts]
    .filter((p) =>
      `${p.message} ${data?.fanpages.find((f) => f.id === p.fanpageId)?.name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "engagement"
        ? engagement(b) - engagement(a)
        : sort === "oldest"
          ? a.createdTime.localeCompare(b.createdTime)
          : b.createdTime.localeCompare(a.createdTime),
    );
  function changePreset(value: string) {
    setPreset(value);
    if (value === "custom") return;
    const end = value === "yesterday" ? shiftDay(todayVN(), -1) : todayVN();
    setTo(end);
    setFrom(
      value === "7days"
        ? shiftDay(end, -6)
        : value === "30days"
          ? shiftDay(end, -29)
          : end,
    );
  }
  const isAdmin = data?.viewer.role === "admin";
  const visibleUsers = data?.users.filter((u) => u.role === "user") || [];
  async function saveForm(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const body =
      form.kind === "review"
        ? {
            action: "review",
            id: form.id,
            status: form.status,
            note: form.note || "",
            employeeId: form.employeeId || null,
          }
        : form.kind === "user"
          ? {
              ...form,
              action: "saveUser",
              password: form.password || undefined,
            }
          : { ...form, action: "savePage" };
    if (await mutate(body)) setForm(null);
  }
  function reviewPost(p: Post) {
    setForm({
      kind: "review",
      id: p.id,
      status: p.status,
      note: p.note,
      employeeId: p.employeeId || "",
    });
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <Activity size={23} />
          </span>
          MediaPulse<span className="brand-dot">.</span>
        </Link>
        <div className="workspace-label">
          <span className="workspace-icon">M</span>
          <div>
            Media Workspace<small>Không gian nội bộ</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-caption">KHÔNG GIAN LÀM VIỆC</div>
        <nav>
          <Link className={section === "dashboard" ? "active" : ""} href="/">
            <LayoutDashboard size={19} />
            Tổng quan
          </Link>
          <Link className={section === "posts" ? "active" : ""} href="/posts">
            <FileText size={19} />
            Bài viết<span className="nav-count">{data?.posts.length || 0}</span>
          </Link>
          {isAdmin && (
            <Link className={section === "admin" ? "active" : ""} href="/admin">
              <Settings2 size={19} />
              Quản lý
            </Link>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="sync-note">
            <span className="tiny-icon">
              <Activity size={18} />
            </span>
            <strong>Dữ liệu luôn trong tầm tay</strong>
            <p>
              Theo dõi hiệu suất. Kết nối đội ngũ.
              <br />
              Tạo nên nội dung tốt hơn.
            </p>
            <span className="source-tag">
              {data?.mode === "mock"
                ? "Môi trường dữ liệu mẫu"
                : "Kết nối cơ sở dữ liệu"}
            </span>
          </div>
          <button
            className="profile"
            onClick={async () => {
              await fetch("/api/auth", { method: "DELETE" });
              window.location.assign("/login");
            }}
          >
            <span className="avatar mint">
              {initials(data?.viewer.name || "MA")}
            </span>
            <span>
              {data?.viewer.name || "Đang tải…"}
              <small>{isAdmin ? "Quản trị viên" : "Nhân viên"}</small>
            </span>
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div>
            Workspace <span>/</span>{" "}
            <strong>
              {section === "dashboard"
                ? "Tổng quan"
                : section === "posts"
                  ? "Bài viết"
                  : "Quản lý"}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="timezone">
              <Clock3 size={14} /> Asia/Ho_Chi_Minh (UTC+7)
            </span>
            <span className="top-avatar">
              {initials(data?.viewer.name || "MA")}
            </span>
          </div>
        </header>
        <div className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">HIỆU SUẤT NỘI DUNG</div>
              <h1>
                {section === "dashboard"
                  ? "Tổng quan hoạt động"
                  : section === "posts"
                    ? "Thư viện bài viết"
                    : "Quản lý workspace"}
                <span className="title-dot" />
              </h1>
              <p>
                {section === "dashboard"
                  ? "Nắm bắt nhịp đăng bài và những kết quả đội ngũ tạo ra."
                  : section === "posts"
                    ? "Theo dõi từng bài đăng, từng tương tác trên các Fanpage."
                    : "Kết nối Fanpage và xây dựng đội ngũ của bạn."}
              </p>
            </div>
            <div className="heading-actions">
              {section !== "admin" && (
                <a className="btn" href={`/api/export?${params}`}>
                  <Download size={16} />
                  Xuất Excel
                </a>
              )}
              {isAdmin && (
                <button
                  disabled={busy || !data}
                  className="btn primary"
                  onClick={() =>
                    void mutate({
                      action: "sync",
                      ...(page ? { id: page } : {}),
                    })
                  }
                >
                  <RefreshCw size={16} className={busy ? "spin" : ""} />
                  {busy ? "Đang xử lý…" : "Đồng bộ dữ liệu"}
                </button>
              )}
            </div>
          </div>
          {error && (
            <div role="alert" className="error notice">
              {error}
              <button onClick={() => setError("")} aria-label="Đóng">
                <X size={16} />
              </button>
            </div>
          )}
          {toast && (
            <div role="status" className="success notice">
              <CheckCircle2 size={17} />
              {toast}
            </div>
          )}
          <div className="mode-banner">
            <span className="mode-symbol">
              <Info size={17} />
            </span>
            <strong>
              {data?.mode === "mock"
                ? "Bạn đang khám phá dữ liệu mẫu"
                : "Không gian làm việc của bạn"}
            </strong>
            <span>
              {data?.mode === "mock"
                ? "Dữ liệu minh họa giúp bạn trải nghiệm đầy đủ luồng làm việc."
                : "Phân quyền được áp dụng trên từng API và báo cáo."}
            </span>
            {isAdmin && (
              <Link href="/admin">
                Quản lý kết nối <ExternalLink size={13} />
              </Link>
            )}
          </div>
          {section !== "admin" && (
            <div className="filters">
              <div className="filter-select date-preset">
                <CalendarDays size={16} />
                <select
                  aria-label="Khoảng thời gian"
                  value={preset}
                  onChange={(e) => changePreset(e.target.value)}
                >
                  <option value="today">Hôm nay</option>
                  <option value="yesterday">Hôm qua</option>
                  <option value="7days">7 ngày qua</option>
                  <option value="30days">30 ngày qua</option>
                  <option value="custom">Tùy chọn khoảng ngày</option>
                </select>
                <ChevronDown size={14} />
              </div>
              <div className="date-range">
                <input
                  aria-label="Từ ngày"
                  type="date"
                  value={from}
                  max={to}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    setPreset("custom");
                  }}
                />
                <span>–</span>
                <input
                  aria-label="Đến ngày"
                  type="date"
                  value={to}
                  min={from}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setPreset("custom");
                  }}
                />
              </div>
              <div className="filter-select">
                <Users size={16} />
                <select
                  aria-label="Lọc nhân viên"
                  value={employee}
                  onChange={(e) => setEmployee(e.target.value)}
                >
                  <option value="">Tất cả nhân viên</option>
                  {data?.users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </div>
              <div className="filter-select">
                <Facebook size={16} />
                <select
                  aria-label="Lọc Fanpage"
                  value={page}
                  onChange={(e) => setPage(e.target.value)}
                >
                  <option value="">Tất cả Fanpage</option>
                  {data?.fanpages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </div>
              <button
                className="icon-btn"
                title="Đặt lại bộ lọc"
                onClick={() => {
                  changePreset("7days");
                  setEmployee("");
                  setPage("");
                }}
              >
                <SlidersHorizontal size={18} />
              </button>
            </div>
          )}
          {!data ? (
            <div className="empty">
              {error ? (
                <button className="btn" onClick={() => void load()}>
                  Thử tải lại
                </button>
              ) : (
                <>
                  <RefreshCw className="spin" />
                  Đang tải workspace…
                </>
              )}
            </div>
          ) : (
            <>
              {section === "dashboard" && (
                <>
                  <div className="kpi-grid">
                    <div className="kpi">
                      <div className="kpi-label">
                        Tổng bài đã đăng
                        <span className="kpi-icon mint">
                          <FileText size={19} />
                        </span>
                      </div>
                      <div className="kpi-value">
                        {num(posts.length)}
                        <small>bài viết</small>
                      </div>
                      <div className="kpi-footer">
                        <span className="green">
                          <CheckCircle2 size={13} />
                          Đã ghi nhận
                        </span>
                        <span>trong khoảng đã chọn</span>
                      </div>
                      <div className="mini-bars">
                        {[28, 45, 30, 52, 42, 66, 56, 80, 65, 90, 74, 100].map(
                          (h, i) => (
                            <span key={i} style={{ height: `${h}%` }} />
                          ),
                        )}
                      </div>
                    </div>
                    <div className="kpi">
                      <div className="kpi-label">
                        Tổng tương tác
                        <span className="kpi-icon blue">
                          <TrendingUp size={19} />
                        </span>
                      </div>
                      <div className="kpi-value">
                        {num(total)}
                        <small>lượt</small>
                      </div>
                      <div className="kpi-footer interactions">
                        <span>
                          <Heart size={13} />
                          {num(posts.reduce((s, p) => s + p.likes, 0))}
                        </span>
                        <span>
                          <MessageCircle size={13} />
                          {num(posts.reduce((s, p) => s + p.comments, 0))}
                        </span>
                        <span>
                          <Share2 size={13} />
                          {num(posts.reduce((s, p) => s + p.shares, 0))}
                        </span>
                      </div>
                    </div>
                    <div className="kpi">
                      <div className="kpi-label">
                        Nhân viên nổi bật
                        <span className="kpi-icon violet">
                          <Users size={19} />
                        </span>
                      </div>
                      <div className="top-employee">
                        <span className="avatar violet">
                          {top ? initials(top.name) : "—"}
                        </span>
                        <div>
                          <strong>{top?.name || "Chưa có dữ liệu"}</strong>
                          <small>
                            {top
                              ? `${num(top.posts)} bài đăng trong kỳ`
                              : "Trong khoảng đã chọn"}
                          </small>
                        </div>
                      </div>
                      <div className="kpi-footer">
                        <span className="purple">Nhiều bài đăng nhất</span>
                      </div>
                    </div>
                    <div className="kpi">
                      <div className="kpi-label">
                        Khung giờ phổ biến
                        <span className="kpi-icon orange">
                          <Clock3 size={19} />
                        </span>
                      </div>
                      <div className="kpi-value">
                        {posts.length
                          ? `${String(hours[0].h).padStart(2, "0")}:00`
                          : "—"}
                        <small>
                          –{" "}
                          {posts.length
                            ? `${String(hours[0].h).padStart(2, "0")}:59`
                            : "—"}
                        </small>
                      </div>
                      <div className="kpi-footer">
                        <span className="orange-text">
                          {hours[0].count} bài đăng
                        </span>
                        <span>· Múi giờ Việt Nam</span>
                      </div>
                    </div>
                  </div>
                  <div className="analytics-grid">
                    <section className="panel chart-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Nhịp đăng bài</h2>
                          <p>Số lượng bài viết theo từng ngày</p>
                        </div>
                        <span className="legend">
                          <i />
                          Bài đã đăng
                        </span>
                      </div>
                      <DailyChart posts={posts} from={from} to={to} />
                    </section>
                    <section className="panel distribution">
                      <div className="panel-heading">
                        <div>
                          <h2>Cơ cấu tương tác</h2>
                          <p>Mỗi tương tác, một kết nối</p>
                        </div>
                        <MoreHorizontal size={18} />
                      </div>
                      <div className="donut-layout">
                        <div
                          className="donut"
                          style={{
                            background: total
                              ? `conic-gradient(#119d7e 0 ${(posts.reduce((s, p) => s + p.likes, 0) / total) * 100}%, #6ecfbb 0 ${(posts.reduce((s, p) => s + p.likes + p.comments, 0) / total) * 100}%, #d3eee6 0 100%)`
                              : "#e7eeeb",
                          }}
                        >
                          <div>
                            <strong>
                              {total >= 1000
                                ? `${(total / 1000).toFixed(1)}k`
                                : total}
                            </strong>
                            <span>tương tác</span>
                          </div>
                        </div>
                        <div className="donut-legend">
                          {[
                            {
                              name: "Lượt thích",
                              key: "likes",
                              color: "#119d7e",
                            },
                            {
                              name: "Bình luận",
                              key: "comments",
                              color: "#6ecfbb",
                            },
                            {
                              name: "Chia sẻ",
                              key: "shares",
                              color: "#d3eee6",
                            },
                          ].map((item) => {
                            const value = posts.reduce(
                              (s, p) => s + p[item.key as "likes"],
                              0,
                            );
                            return (
                              <div key={item.key}>
                                <span>
                                  <i style={{ background: item.color }} />
                                  {item.name}
                                </span>
                                <strong>{num(value)}</strong>
                                <small>
                                  {total
                                    ? ((value / total) * 100).toFixed(1)
                                    : 0}
                                  %
                                </small>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </section>
                  </div>
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>
                          Hiệu suất theo nhân viên{" "}
                          <span className="count-badge">
                            {report.length} nhân viên
                          </span>
                        </h2>
                        <p>
                          Bức tranh hiệu suất của đội ngũ trong khoảng thời gian
                          đã chọn
                        </p>
                      </div>
                      <Link className="text-link" href={`/posts?${params}`}>
                        Xem bài viết <ExternalLink size={14} />
                      </Link>
                    </div>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>NHÂN VIÊN</th>
                            <th>FANPAGE PHỤ TRÁCH</th>
                            <th className="number">BÀI ĐĂNG</th>
                            <th className="number">LIKE</th>
                            <th className="number">COMMENT</th>
                            <th className="number">SHARE</th>
                            <th className="number">TƯƠNG TÁC</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.map((r, i) => (
                            <tr key={r.id}>
                              <td>
                                <div className="person-cell">
                                  <span className={`avatar ${colors[i % 4]}`}>
                                    {initials(r.name)}
                                  </span>
                                  <div>
                                    <strong>{r.name}</strong>
                                    <small>
                                      {
                                        data.users.find((u) => u.id === r.id)
                                          ?.email
                                      }
                                    </small>
                                  </div>
                                  {i === 0 && r.posts > 0 && (
                                    <span className="top-badge">TOP</span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <div className="page-tags">
                                  {data.fanpages
                                    .filter((p) => p.employeeIds.includes(r.id))
                                    .map((p) => (
                                      <span key={p.id}>{p.name}</span>
                                    ))}
                                </div>
                              </td>
                              <td className="number">
                                <strong>{num(r.posts)}</strong>
                              </td>
                              <td className="number">{num(r.likes)}</td>
                              <td className="number">{num(r.comments)}</td>
                              <td className="number">{num(r.shares)}</td>
                              <td className="number">
                                <span className="total-cell">
                                  {num(r.total)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!report.length && (
                        <div className="empty">
                          Chưa có nhân viên phù hợp với bộ lọc.
                        </div>
                      )}
                    </div>
                    <div className="table-footer">
                      <span>
                        {posts.filter((p) => !p.employeeId).length} bài chưa
                        phân công · Không tính lặp cho nhiều nhân viên
                      </span>
                      <span>Hiển thị {report.length} nhân viên</span>
                    </div>
                  </section>
                  <div className="bottom-note">
                    <Shield size={14} />
                    Dữ liệu hiển thị theo quyền truy cập của bạn. Thời gian được
                    quy đổi về UTC+7.
                  </div>
                </>
              )}
              {section === "posts" && (
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>
                        Tất cả bài viết{" "}
                        <span className="count-badge">
                          {displayPosts.length}
                        </span>
                      </h2>
                      <p>
                        {data.mode === "mock"
                          ? "Link mẫu mở Fanpage minh họa; không phải bài đăng thật."
                          : "Chỉ số được cập nhật tại lần đồng bộ gần nhất."}
                      </p>
                    </div>
                    <div className="table-tools">
                      <div className="search-box">
                        <Search size={16} />
                        <input
                          aria-label="Tìm bài viết"
                          placeholder="Tìm nội dung, Fanpage…"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                      </div>
                      <select
                        className="plain-select"
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                        aria-label="Sắp xếp bài viết"
                      >
                        <option value="newest">Mới nhất</option>
                        <option value="oldest">Cũ nhất</option>
                        <option value="engagement">Tương tác cao nhất</option>
                      </select>
                    </div>
                  </div>
                  <div className="table-wrap">
                    <table className="posts-table">
                      <thead>
                        <tr>
                          <th>THỜI GIAN (UTC+7)</th>
                          <th>FANPAGE / NHÂN VIÊN</th>
                          <th>NỘI DUNG</th>
                          <th className="number">LIKE</th>
                          <th className="number">COMMENT</th>
                          <th className="number">SHARE</th>
                          <th className="number">TỔNG</th>
                          <th>KIỂM DUYỆT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayPosts
                          .slice((pagination - 1) * 10, pagination * 10)
                          .map((p) => (
                            <tr key={p.id}>
                              <td>
                                <strong>
                                  {new Intl.DateTimeFormat("vi-VN", {
                                    timeZone: "Asia/Ho_Chi_Minh",
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                  }).format(new Date(p.createdTime))}
                                </strong>
                                <small className="block">
                                  {new Intl.DateTimeFormat("vi-VN", {
                                    timeZone: "Asia/Ho_Chi_Minh",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }).format(new Date(p.createdTime))}
                                </small>
                              </td>
                              <td>
                                <strong>
                                  {
                                    data.fanpages.find(
                                      (f) => f.id === p.fanpageId,
                                    )?.name
                                  }
                                </strong>
                                <small className="block">
                                  {data.users.find((u) => u.id === p.employeeId)
                                    ?.name || "Chưa phân công"}
                                </small>
                              </td>
                              <td>
                                <a
                                  className="post-link"
                                  href={p.permalinkUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <span>{p.message}</span>
                                  <ExternalLink size={14} />
                                </a>
                                {p.note && (
                                  <small className="block">
                                    Ghi chú: {p.note}
                                  </small>
                                )}
                              </td>
                              <td className="number">{num(p.likes)}</td>
                              <td className="number">{num(p.comments)}</td>
                              <td className="number">{num(p.shares)}</td>
                              <td className="number total-cell">
                                {num(engagement(p))}
                              </td>
                              <td>
                                <button
                                  disabled={!isAdmin}
                                  className={`status ${p.status}`}
                                  onClick={() => reviewPost(p)}
                                >
                                  {p.status === "approved"
                                    ? "Đã duyệt"
                                    : p.status === "flagged"
                                      ? "Cần xem lại"
                                      : "Chờ duyệt"}
                                  {isAdmin && <Pencil size={11} />}
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    {!displayPosts.length && (
                      <div className="empty">
                        <FileText />
                        Không có bài viết trong khoảng thời gian này.
                      </div>
                    )}
                  </div>
                  <div className="table-footer">
                    <span>
                      {displayPosts.length ? (pagination - 1) * 10 + 1 : 0}–
                      {Math.min(pagination * 10, displayPosts.length)} trong{" "}
                      {displayPosts.length} bài viết
                    </span>
                    <div className="pagination">
                      <button
                        className="icon-btn"
                        aria-label="Trang trước"
                        disabled={pagination === 1}
                        onClick={() => setPagination(pagination - 1)}
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span>
                        Trang {pagination} /{" "}
                        {Math.max(1, Math.ceil(displayPosts.length / 10))}
                      </span>
                      <button
                        className="icon-btn"
                        aria-label="Trang tiếp"
                        disabled={pagination * 10 >= displayPosts.length}
                        onClick={() => setPagination(pagination + 1)}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </section>
              )}
              {section === "admin" && isAdmin && (
                <>
                  <div className="admin-tabs">
                    <button
                      className={tab === "pages" ? "selected" : ""}
                      onClick={() => setTab("pages")}
                    >
                      <Facebook size={17} />
                      Fanpage <span>{data.fanpages.length}</span>
                    </button>
                    <button
                      className={tab === "users" ? "selected" : ""}
                      onClick={() => setTab("users")}
                    >
                      <Users size={17} />
                      Nhân viên <span>{data.users.length}</span>
                    </button>
                    <button
                      className={tab === "settings" ? "selected" : ""}
                      onClick={() => setTab("settings")}
                    >
                      <Settings2 size={17} />
                      Cấu hình
                    </button>
                  </div>
                  {tab === "pages" && (
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Fanpage đã kết nối</h2>
                          <p>
                            Quản lý nguồn dữ liệu và phân công đội ngũ phụ
                            trách.
                          </p>
                        </div>
                        <button
                          className="btn primary"
                          onClick={() =>
                            setForm({
                              kind: "page",
                              name: "",
                              url: "",
                              token: "",
                              source: "mock",
                              employeeIds: [],
                            })
                          }
                        >
                          <Plus size={16} />
                          Thêm Fanpage
                        </button>
                      </div>
                      <div className="page-card-grid">
                        {data.fanpages.map((p, i) => (
                          <div className="page-card" key={p.id}>
                            <div className="page-card-top">
                              <span className={`page-avatar ${colors[i % 4]}`}>
                                {initials(p.name)}
                              </span>
                              <span className={`source-label ${p.source}`}>
                                {p.source === "mock"
                                  ? "Dữ liệu mẫu"
                                  : "Facebook API"}
                              </span>
                              <button
                                className="icon-btn"
                                aria-label={`Sửa ${p.name}`}
                                onClick={() =>
                                  setForm({ kind: "page", ...p, token: "" })
                                }
                              >
                                <Pencil size={15} />
                              </button>
                            </div>
                            <h3>{p.name}</h3>
                            <a
                              className="page-url"
                              href={p.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              ID: {p.pageId}
                              <ExternalLink size={12} />
                            </a>
                            <div className="assigned">
                              <Users size={14} />
                              {p.employeeIds
                                .map(
                                  (id) =>
                                    data.users.find((u) => u.id === id)?.name,
                                )
                                .join(", ") || "Chưa phân công"}
                            </div>
                            <div className="page-sync">
                              Đồng bộ:{" "}
                              {p.lastSync
                                ? new Date(p.lastSync).toLocaleString("vi-VN", {
                                    timeZone: "Asia/Ho_Chi_Minh",
                                  })
                                : "Chưa đồng bộ"}
                            </div>
                            <div className="page-card-actions">
                              <button
                                className="btn"
                                disabled={busy}
                                onClick={() =>
                                  void mutate({ action: "sync", id: p.id })
                                }
                              >
                                <RefreshCw size={14} />
                                Sync now
                              </button>
                              <button
                                className="icon-btn danger"
                                aria-label={`Xóa ${p.name}`}
                                onClick={() =>
                                  setDeletion({
                                    action: "deletePage",
                                    id: p.id,
                                    name: p.name,
                                  })
                                }
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      {!data.fanpages.length && (
                        <div className="empty">
                          Thêm Fanpage đầu tiên để bắt đầu.
                        </div>
                      )}
                    </section>
                  )}
                  {tab === "users" && (
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Đội ngũ của bạn</h2>
                          <p>Quản lý tài khoản và quyền truy cập.</p>
                        </div>
                        <button
                          className="btn primary"
                          onClick={() =>
                            setForm({
                              kind: "user",
                              name: "",
                              email: "",
                              role: "user",
                              password: "",
                              facebookUserId: "",
                            })
                          }
                        >
                          <Plus size={16} />
                          Thêm nhân viên
                        </button>
                      </div>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>NHÂN VIÊN</th>
                              <th>EMAIL</th>
                              <th>VAI TRÒ</th>
                              <th>FANPAGE</th>
                              <th>THAO TÁC</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.users.map((u, i) => (
                              <tr key={u.id}>
                                <td>
                                  <div className="person-cell">
                                    <span className={`avatar ${colors[i % 4]}`}>
                                      {initials(u.name)}
                                    </span>
                                    <strong>{u.name}</strong>
                                  </div>
                                </td>
                                <td>{u.email}</td>
                                <td>
                                  <span
                                    className={`status ${u.role === "admin" ? "approved" : "pending"}`}
                                  >
                                    {u.role === "admin"
                                      ? "Quản trị viên"
                                      : "Nhân viên"}
                                  </span>
                                </td>
                                <td>
                                  {
                                    data.fanpages.filter((p) =>
                                      p.employeeIds.includes(u.id),
                                    ).length
                                  }{" "}
                                  Fanpage
                                </td>
                                <td>
                                  <div className="row-actions">
                                    <button
                                      className="icon-btn"
                                      aria-label={`Sửa ${u.name}`}
                                      onClick={() =>
                                        setForm({
                                          kind: "user",
                                          ...u,
                                          facebookUserId:
                                            u.facebookUserId || "",
                                          password: "",
                                        })
                                      }
                                    >
                                      <Pencil size={16} />
                                    </button>
                                    <button
                                      disabled={u.id === data.viewer.id}
                                      className="icon-btn danger"
                                      aria-label={`Xóa ${u.name}`}
                                      onClick={() =>
                                        setDeletion({
                                          action: "deleteUser",
                                          id: u.id,
                                          name: u.name,
                                        })
                                      }
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}
                  {tab === "settings" && (
                    <section className="panel settings-panel">
                      <h2>Cấu hình hệ thống</h2>
                      <div className="setting-row">
                        <div>
                          <strong>Nhân viên xem toàn công ty</strong>
                          <p>
                            Khi tắt, nhân viên chỉ xem dữ liệu của các Page được
                            phân công.
                          </p>
                        </div>
                        <input
                          aria-label="Xem toàn công ty"
                          type="checkbox"
                          checked={data.settings.companyWide}
                          disabled={busy}
                          onChange={(e) =>
                            void mutate({
                              action: "settings",
                              settings: {
                                ...data.settings,
                                companyWide: e.target.checked,
                              },
                            })
                          }
                        />
                      </div>
                      <div className="setting-row">
                        <div>
                          <strong>Cho phép đồng bộ cuối ngày</strong>
                          <p>
                            Bật endpoint cron. Cần cấu hình bộ lập lịch bên
                            ngoài gọi lúc 16:55 UTC (23:55 Việt Nam).
                          </p>
                        </div>
                        <input
                          aria-label="Bật cron"
                          type="checkbox"
                          checked={data.settings.cronEnabled}
                          disabled={busy}
                          onChange={(e) =>
                            void mutate({
                              action: "settings",
                              settings: {
                                ...data.settings,
                                cronEnabled: e.target.checked,
                              },
                            })
                          }
                        />
                      </div>
                      <div className="mode-banner">
                        <Info size={18} />
                        Dữ liệu được lưu bền vững trên cloud. Chọn nguồn
                        Facebook API khi thêm Fanpage để kết nối dữ liệu thật.
                      </div>
                    </section>
                  )}
                </>
              )}
            </>
          )}
          <footer className="app-footer">
            <span>
              MediaPulse <span className="footer-dot">·</span> Built for your
              team.
            </span>
            <span>
              <span className="connection-dot" />
              {data?.fanpages.length || 0} Fanpage trong workspace
            </span>
          </footer>
        </div>
      </main>
      {form && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="modal-heading">
              <h2 id="modal-title">
                {form.kind === "review"
                  ? "Kiểm duyệt bài viết"
                  : `${form.id ? "Chỉnh sửa" : "Thêm"} ${form.kind === "user" ? "nhân viên" : "Fanpage"}`}
              </h2>
              <button
                aria-label="Đóng"
                className="icon-btn"
                onClick={() => setForm(null)}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={saveForm}>
              {form.kind === "user" && (
                <>
                  <label>
                    Họ và tên
                    <input
                      required
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Email
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Vai trò
                    <select
                      value={form.role}
                      onChange={(e) =>
                        setForm({ ...form, role: e.target.value })
                      }
                    >
                      <option value="user">Nhân viên (read-only)</option>
                      <option value="admin">Quản trị viên</option>
                    </select>
                  </label>
                  <label>
                    Mật khẩu {form.id ? "(để trống để giữ nguyên)" : ""}
                    <input
                      type="password"
                      minLength={10}
                      required={!form.id}
                      value={form.password}
                      onChange={(e) =>
                        setForm({ ...form, password: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Facebook User ID (nếu có)
                    <input
                      value={form.facebookUserId}
                      onChange={(e) =>
                        setForm({ ...form, facebookUserId: e.target.value })
                      }
                      placeholder="Dùng để đối chiếu admin_creator"
                    />
                  </label>
                </>
              )}
              {form.kind === "page" && (
                <>
                  <label>
                    Tên Fanpage
                    <input
                      required
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Link Fanpage hoặc Page ID
                    <input
                      required
                      value={form.url}
                      onChange={(e) =>
                        setForm({ ...form, url: e.target.value })
                      }
                      placeholder="https://facebook.com/tenpage"
                    />
                  </label>
                  <label>
                    Nguồn dữ liệu
                    <select
                      disabled={!!form.id}
                      value={form.source}
                      onChange={(e) =>
                        setForm({ ...form, source: e.target.value })
                      }
                    >
                      <option value="mock">
                        Dữ liệu mẫu · không cần token
                      </option>
                      <option value="facebook">Facebook Graph API</option>
                    </select>
                  </label>
                  {form.source === "facebook" && (
                    <label>
                      Page Access Token{" "}
                      {form.id ? "(trống = giữ token cũ)" : ""}
                      <input
                        type="password"
                        autoComplete="off"
                        required={!form.id}
                        value={form.token}
                        onChange={(e) =>
                          setForm({ ...form, token: e.target.value })
                        }
                      />
                      <small>Token chỉ lưu ở server, mã hóa AES-256-GCM.</small>
                    </label>
                  )}
                  <label>Nhân viên phụ trách</label>
                  <div className="checkbox-list">
                    {data?.users.map((u) => (
                      <label key={u.id}>
                        <input
                          type="checkbox"
                          checked={form.employeeIds?.includes(u.id) || false}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              employeeIds: e.target.checked
                                ? [...(form.employeeIds || []), u.id]
                                : form.employeeIds?.filter((id) => id !== u.id),
                            })
                          }
                        />
                        {u.name}
                      </label>
                    ))}
                  </div>
                  <small>
                    Cần ít nhất 1 người. Khi có nhiều người, bài không rõ tác
                    giả sẽ chờ Admin phân công.
                  </small>
                </>
              )}
              {form.kind === "review" && (
                <>
                  <label>
                    Trạng thái
                    <select
                      value={form.status}
                      onChange={(e) =>
                        setForm({ ...form, status: e.target.value })
                      }
                    >
                      <option value="pending">Chờ duyệt</option>
                      <option value="approved">Đã duyệt</option>
                      <option value="flagged">Cần xem lại</option>
                    </select>
                  </label>
                  <label>
                    Nhân viên phụ trách
                    <select
                      value={form.employeeId}
                      onChange={(e) =>
                        setForm({ ...form, employeeId: e.target.value })
                      }
                    >
                      <option value="">Chưa phân công</option>
                      {data?.users
                        .filter((u) =>
                          data.fanpages
                            .find(
                              (p) =>
                                p.id ===
                                data.posts.find((p) => p.id === form.id)
                                  ?.fanpageId,
                            )
                            ?.employeeIds.includes(u.id),
                        )
                        .map((u) => (
                          <option value={u.id} key={u.id}>
                            {u.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Ghi chú
                    <textarea
                      maxLength={2000}
                      rows={4}
                      value={form.note}
                      onChange={(e) =>
                        setForm({ ...form, note: e.target.value })
                      }
                    />
                  </label>
                </>
              )}
              {error && <div className="error">{error}</div>}
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setForm(null)}
                >
                  Hủy
                </button>
                <button className="btn primary" disabled={busy}>
                  {busy
                    ? "Đang lưu…"
                    : form.kind === "page" && form.source === "facebook"
                      ? "Test Connection & Sync Now"
                      : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {deletion && (
        <div className="modal-backdrop">
          <section
            className="modal small-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <h2 id="delete-title">Xóa {deletion.name}?</h2>
            <p>
              {deletion.action === "deletePage"
                ? "Toàn bộ bài viết của Fanpage này cũng sẽ bị xóa."
                : "Các bài viết cũ sẽ được chuyển về trạng thái chưa phân công."}
            </p>
            <div className="modal-actions">
              <button className="btn" onClick={() => setDeletion(null)}>
                Hủy
              </button>
              <button
                className="btn destructive"
                disabled={busy}
                onClick={async () => {
                  if (await mutate(deletion)) setDeletion(null);
                }}
              >
                Xóa
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
function DailyChart({
  posts,
  from,
  to,
}: {
  posts: Post[];
  from: string;
  to: string;
}) {
  const days = Math.min(
    62,
    Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1),
  );
  const values = Array.from({ length: days }, (_, i) => {
    const day = shiftDay(from, i);
    return { day, count: posts.filter((p) => p.postDate === day).length };
  });
  const max = Math.max(4, ...values.map((v) => v.count));
  return (
    <div className="daily-chart">
      <div className="chart-y">
        {[
          max,
          Math.round(max * 0.75),
          Math.round(max * 0.5),
          Math.round(max * 0.25),
          0,
        ].map((n, i) => (
          <span key={i}>{n}</span>
        ))}
      </div>
      <div className="chart-plot">
        <div className="chart-grid">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} />
          ))}
        </div>
        <div className="chart-bars">
          {values.map((v, i) => (
            <div className="bar-column" key={v.day}>
              <div
                className={`chart-bar ${i === values.length - 1 ? "last" : ""}`}
                style={{ height: `${(v.count / max) * 100}%` }}
                title={`${v.day}: ${v.count} bài`}
              >
                <span>{v.count}</span>
              </div>
              <small>
                {days <= 14 || i % Math.ceil(days / 10) === 0
                  ? `${v.day.slice(8)}/${v.day.slice(5, 7)}`
                  : ""}
              </small>
            </div>
          ))}
        </div>
      </div>
      {days === 62 && (
        <small>
          Biểu đồ hiển thị tối đa 62 ngày; KPI và bảng vẫn tính toàn bộ khoảng.
        </small>
      )}
    </div>
  );
}
