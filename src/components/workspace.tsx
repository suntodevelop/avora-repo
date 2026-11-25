"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Download,
  RefreshCw,
  Info,
  Search,
  ExternalLink,
  FileText,
  Users,
  TrendingUp,
  Clock3,
  X,
  Pencil,
} from "lucide-react";
import type { Snapshot, Post, ManualCheck } from "@/lib/types";
import { todayVN, shiftDay, engagement } from "@/lib/time";
import { employeeReport, filteredChecks, filteredPosts } from "@/lib/report";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import FacebookSyncDialog from "./facebook-sync-dialog";
import Management, { pageHref } from "./management";
import DonutChart from "./donut-chart";
import StatusBadge, { TrackingBadge } from "./status-badge";
import EmployeePostCards from "./employee-post-cards";
import DateRangePicker from "./ui/date-range-picker";
import { Select, ScrollArea } from "./ui/primitives";
import PageHeading from "./ui/page-heading";
const num = (value: number) => value.toLocaleString("vi-VN");
export default function Workspace({
  section,
}: {
  section: "dashboard" | "posts" | "admin" | "staff" | "users";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<Snapshot>();
  const initialized = useRef(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [from, setFrom] = useState(
    section === "posts" ? todayVN() : shiftDay(todayVN(), -6),
  );
  const [to, setTo] = useState(todayVN());
  const [preset, setPreset] = useState(
    section === "posts" ? "latest" : "7days",
  );
  const [employee, setEmployee] = useState("");
  const [page, setPage] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [review, setReview] = useState<Post | null>(null);
  const management =
    section === "admin" || section === "staff" || section === "users";
  async function load() {
    try {
      const response = await fetch("/api/data", { cache: "no-store" });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (response.status === 403) {
        router.replace("/");
        return;
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setData(result);
      if (
        section === "posts" &&
        !initialized.current &&
        !new URLSearchParams(window.location.search).has("from")
      ) {
        const latest =
          [
            ...result.posts.map((post: Post) => post.postDate),
            ...result.fanpages.flatMap(
              (p: { syncedDates?: string[] }) => p.syncedDates || [],
            ),
            ...result.manualChecks.map((check: ManualCheck) => check.date),
          ]
            .sort()
            .at(-1) || todayVN();
        setFrom(latest);
        setTo(latest);
        setPreset("latest");
      }
      initialized.current = true;
      setError("");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Không thể tải dữ liệu",
      );
    }
  }
  useEffect(() => {
    const query = searchParams;
    if (query.get("from") && query.get("to")) {
      setFrom(query.get("from")!);
      setTo(query.get("to")!);
      setPreset("custom");
    }
    setEmployee(query.get("employee") || "");
    setPage(query.get("page") || "");
  }, [searchParams]);
  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener("avora-profile-updated", refresh);
    return () => window.removeEventListener("avora-profile-updated", refresh);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 7000);
    return () => clearTimeout(timeout);
  }, [toast]);
  async function run(body: unknown) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await load();
      const mutation = body as { action?: string; id?: string };
      if (mutation.action === "saveUser" && mutation.id === data?.viewer.id)
        window.dispatchEvent(new Event("avora-profile-updated"));
      const failures = result.results?.filter(
        (result: { success: boolean }) => !result.success,
      );
      if (failures?.length)
        setError(
          failures
            .map(
              (result: { page: string; error: string }) =>
                `${result.page}: ${result.error}`,
            )
            .join(" · "),
        );
      else
        setToast(
          result.results
            ? "Đã đồng bộ các Page có kết nối. Dữ liệu thủ công được giữ nguyên."
            : "Đã lưu thay đổi",
        );
      return true;
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Không thể lưu thay đổi",
      );
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
        ...(section === "posts" && search.trim() ? { q: search.trim() } : {}),
      }),
    [from, to, employee, page, section, search],
  );
  const posts = data ? filteredPosts(data, params) : [];
  const checks = data ? filteredChecks(data, params) : [];
  const report = data ? employeeReport(data, params) : [];
  const totalPosts =
    posts.length +
    checks.reduce((sum, check) => sum + (check.postCount ?? 0), 0);
  const missing = checks.filter((check) => check.postCount === null).length;
  const totalEngagement = posts.reduce(
    (sum, post) => sum + engagement(post),
    0,
  );
  const topHour = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: posts.filter((post) => post.postHour === hour).length,
  })).sort((a, b) => b.count - a.count)[0];
  const detailed = [...posts].sort((a, b) =>
    sort === "engagement"
      ? engagement(b) - engagement(a)
      : sort === "oldest"
        ? a.createdTime.localeCompare(b.createdTime)
        : b.createdTime.localeCompare(a.createdTime),
  );
  const manual = [...checks].sort((a, b) =>
    sort === "count"
      ? (b.postCount ?? -1) - (a.postCount ?? -1)
      : sort === "oldest"
        ? a.date.localeCompare(b.date)
        : b.date.localeCompare(a.date),
  );
  const isAdmin = data?.viewer.role === "admin";
  function choosePreset(value: string) {
    setPreset(value);
    if (value === "custom") return;
    if (value === "latest") {
      const latest =
        [
          ...(data?.posts.map((p) => p.postDate) || []),
          ...(data?.fanpages.flatMap((p) => p.syncedDates || []) || []),
          ...(data?.manualChecks.map((c) => c.date) || []),
        ]
          .sort()
          .at(-1) || todayVN();
      setFrom(latest);
      setTo(latest);
      return;
    }
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
  return (
    <>
      <PageHeading
        title={
          section === "dashboard"
            ? "Tổng quan hoạt động"
            : section === "posts"
              ? "Bài viết & số liệu đã check"
              : section === "staff"
                ? "Fanpage của tôi"
                : section === "users"
                  ? "Quản lý User"
                  : "Quản lý bài đăng"
        }
        description={
          section === "users"
            ? "Quản lý tài khoản, vai trò và thông tin nhân sự. Tài khoản Admin được bảo vệ."
            : management
              ? isAdmin
                ? "Quản lý toàn bộ nhân viên, Fanpage và Facebook phụ trách."
                : "Thêm, sửa và cập nhật Fanpage được giao cho bạn."
              : "Theo dõi dữ liệu công ty theo khoảng thời gian và người phụ trách."
        }
        actions={
          !management || (isAdmin && section !== "users") ? (
            <>
              {!management && (
                <a className="btn" href={`/api/export?${params}`}>
                  <Download size={16} />
                  Xuất Excel
                </a>
              )}
              {isAdmin && (
                <button
                  className="btn primary"
                  disabled={busy}
                  onClick={() => setSyncOpen(true)}
                >
                  <RefreshCw size={16} className={busy ? "spin" : ""} />
                  {busy ? "Đang xử lý…" : "Đồng bộ Facebook"}
                </button>
              )}
            </>
          ) : undefined
        }
      />
      {syncOpen && data && (
        <FacebookSyncDialog
          data={data}
          pageId={page}
          employeeId={employee}
          onClose={() => setSyncOpen(false)}
          onComplete={async (date, employeeId, pageId) => {
            await load();
            setEmployee(employeeId);
            setPage(pageId);
            setSearch("");
            setFrom(date);
            setTo(date);
            setPreset("custom");
          }}
        />
      )}
      {error && (
        <div role="alert" className="error notice">
          {error}
          <button aria-label="Đóng lỗi" onClick={() => setError("")}>
            <X size={17} />
          </button>
        </div>
      )}
      {toast && (
        <div role="status" className="success notice">
          {toast}
        </div>
      )}
      <div
        className={`mode-banner ${section === "posts" || section === "users" ? "posts-source-banner" : ""}`}
      >
        <Info size={18} />
        <strong>
          {data?.mode === "mock" ? "Dữ liệu mẫu" : "Dữ liệu AVORA MEDIA"}
        </strong>
        <span>
          {data?.manualChecks.length
            ? "Số liệu Excel được lưu riêng. Chưa có nội dung hoặc giờ đăng khi chưa kết nối Facebook API."
            : "Dữ liệu được hiển thị theo quyền truy cập của bạn."}
        </span>
      </div>

      {!management && section !== "posts" && (
        <div className="filters">
          <div className="filter-select">
            <CalendarDays size={16} />
            <Select
              aria-label="Khoảng thời gian"
              value={preset}
              onChange={(event) => choosePreset(event.target.value)}
            >
              <option value="today">Hôm nay</option>
              <option value="yesterday">Hôm qua</option>
              <option value="7days">7 ngày qua</option>
              <option value="30days">30 ngày qua</option>
              <option value="custom">Tùy chọn</option>
            </Select>
          </div>
          <DateRangePicker
            from={from}
            to={to}
            onChange={(start, end) => {
              setFrom(start);
              setTo(end);
              setPreset("custom");
            }}
          />
          <div className="filter-select">
            <Select
              aria-label="Lọc nhân viên"
              value={employee}
              onChange={(event) => setEmployee(event.target.value)}
            >
              <option value="">Tất cả nhân viên</option>
              {data?.users
                .filter((user) =>
                  data.fanpages.some((page) =>
                    page.employeeIds.includes(user.id),
                  ),
                )
                .map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
            </Select>
          </div>
          <div className="filter-select">
            <Select
              aria-label="Lọc Fanpage"
              value={page}
              onChange={(event) => setPage(event.target.value)}
            >
              <option value="">Tất cả Fanpage</option>
              {data?.fanpages.map((page) => (
                <option key={page.id} value={page.id}>
                  {page.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      )}
      {!data ? (
        <div className="empty">
          {error ? (
            <button className="btn" onClick={() => void load()}>
              Thử tải lại
            </button>
          ) : (
            "Đang tải workspace…"
          )}
        </div>
      ) : management ? (
        <Management
          data={data}
          run={run}
          busy={busy}
          view={section === "users" ? "users" : "pages"}
        />
      ) : (
        <>
          {section === "dashboard" && (
            <>
              <div className="kpi-grid">
                <div className="kpi">
                  <div className="kpi-label">
                    Tổng số bài ghi nhận
                    <FileText size={20} />
                  </div>
                  <div className="kpi-value">
                    {num(totalPosts)}
                    <small>bài</small>
                  </div>
                  <p className="block">
                    {checks.length
                      ? `${checks.length} dòng check thủ công`
                      : `${posts.length} bài chi tiết`}
                  </p>
                </div>
                <div className="kpi">
                  <div className="kpi-label">
                    Tương tác từ bài chi tiết
                    <TrendingUp size={20} />
                  </div>
                  <div className="kpi-value">
                    {posts.length &&
                    posts.every(
                      (p) =>
                        p.likesAvailable !== false &&
                        p.commentsAvailable !== false,
                    )
                      ? num(totalEngagement)
                      : "—"}
                  </div>
                  <p className="block">
                    {posts.length
                      ? "Like + Comment + Share"
                      : "File nguồn chưa có Like / Share"}
                  </p>
                </div>
                <div className="kpi">
                  <div className="kpi-label">
                    Nhân viên nhiều bài nhất
                    <Users size={20} />
                  </div>
                  <div className="top-employee">
                    <strong>
                      {report.find((row) => row.posts > 0)?.name ||
                        "Chưa có dữ liệu"}
                    </strong>
                  </div>
                  <p className="block">
                    {report[0]?.posts
                      ? `${num(report[0].posts)} bài được ghi nhận`
                      : "Trong khoảng ngày đã chọn"}
                  </p>
                </div>
                <div className="kpi">
                  <div className="kpi-label">
                    Khung giờ phổ biến
                    <Clock3 size={20} />
                  </div>
                  <div className="kpi-value">
                    {posts.length
                      ? `${String(topHour.hour).padStart(2, "0")}:00`
                      : "—"}
                  </div>
                  <p className="block">
                    {posts.length
                      ? `${topHour.count} bài trong khung giờ`
                      : "Chưa có giờ đăng chi tiết"}
                  </p>
                </div>
              </div>
              {missing > 0 && (
                <div className="mode-banner warning-banner">
                  {missing} dòng chưa có số bài hợp lệ (trống / SOS). Tổng chưa
                  bao gồm các dòng này.
                </div>
              )}
              <div className="analytics-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Số bài theo ngày</h2>
                      <p>
                        Bao gồm số bài thủ công và các bài chi tiết, không đếm
                        trùng nguồn.
                      </p>
                    </div>
                  </div>
                  <DailyChart
                    posts={posts}
                    checks={checks}
                    from={from}
                    to={to}
                  />
                </section>
                <DonutChart
                  items={report.map((row) => ({
                    id: row.id,
                    label: row.name,
                    value: row.posts,
                  }))}
                />
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Hiệu suất theo nhân viên</h2>
                    <p>
                      Chỉ tính số lượng đã có. Chỉ số tương tác thiếu được hiển
                      thị bằng dấu —.
                    </p>
                  </div>
                  <Link className="text-link" href={`/posts?${params}`}>
                    Xem dữ liệu <ExternalLink size={15} />
                  </Link>
                </div>
                <ScrollArea className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>NHÂN VIÊN</th>
                        <th>FANPAGE</th>
                        <th className="number">BÀI ĐĂNG</th>
                        <th className="number">LIKE</th>
                        <th className="number">COMMENT</th>
                        <th className="number">SHARE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <strong>{row.name}</strong>
                            {row.missingCounts > 0 && (
                              <small className="block warning-text">
                                {row.missingCounts} dòng thiếu số bài
                              </small>
                            )}
                          </td>
                          <td>
                            <span className="page-count-label">
                              {
                                data.fanpages.filter((page) =>
                                  page.employeeIds.includes(row.id),
                                ).length
                              }{" "}
                              Fanpage
                            </span>
                          </td>
                          <td className="number total-cell">
                            {row.hasCounts ? num(row.posts) : "Chưa có số liệu"}
                          </td>
                          <td className="number">
                            {row.likesKnown ? num(row.likes) : "—"}
                          </td>
                          <td className="number">
                            {row.commentsKnown ? num(row.comments) : "—"}
                          </td>
                          <td className="number">
                            {row.metricsKnown ? num(row.shares) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!report.length && (
                    <div className="empty">Chưa có dữ liệu phù hợp.</div>
                  )}
                </ScrollArea>
              </section>
            </>
          )}
          {section === "posts" && (
            <>
              <section className="panel filtered-summary" aria-live="polite">
                <div>
                  <span className="eyebrow">KẾT QUẢ THEO BỘ LỌC</span>
                  <div className="filtered-count">
                    <strong data-testid="filtered-post-total">
                      {num(totalPosts)}
                    </strong>
                    <span>bài đã ghi nhận</span>
                  </div>
                  <p>
                    {
                      new Set([
                        ...manual.map((item) => item.fanpageId),
                        ...detailed.map((item) => item.fanpageId),
                      ]).size
                    }{" "}
                    Fanpage · {detailed.length} bài có nội dung
                    {missing > 0
                      ? " · " + missing + " dòng chưa có số bài"
                      : ""}
                  </p>
                </div>
                <div className="filter-context">
                  <strong>
                    {from.split("-").reverse().join("/")} —{" "}
                    {to.split("-").reverse().join("/")}
                  </strong>
                  <span>
                    {data.users.find((user) => user.id === employee)?.name ||
                      "Tất cả nhân viên"}{" "}
                    ·{" "}
                    {data.fanpages.find((item) => item.id === page)?.name ||
                      "Tất cả Fanpage"}
                  </span>
                  {search && <small>Tìm kiếm: “{search}”</small>}
                </div>
              </section>
              <section className="panel post-filter-toolbar">
                <div className="post-search-row">
                  <div className="search-box">
                    <Search size={17} />
                    <input
                      aria-label="Tìm dữ liệu bài viết"
                      placeholder="Tìm tên Page, nhân viên, nội dung…"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>
                  <Select
                    className="plain-select"
                    aria-label="Sắp xếp bài viết"
                    value={sort}
                    onChange={(event) => setSort(event.target.value)}
                  >
                    <option value="newest">Mới nhất</option>
                    <option value="oldest">Cũ nhất</option>
                    <option value="engagement">
                      Tương tác cao nhất (bài chi tiết)
                    </option>
                    <option value="count">Số bài cao nhất (thủ công)</option>
                  </Select>
                </div>
                <div className="filters">
                  <div className="filter-select">
                    <CalendarDays size={16} />
                    <Select
                      aria-label="Khoảng thời gian"
                      value={preset}
                      onChange={(event) => choosePreset(event.target.value)}
                    >
                      {section === "posts" && (
                        <option value="latest">Ngày mới nhất có dữ liệu</option>
                      )}
                      <option value="today">Hôm nay</option>
                      <option value="yesterday">Hôm qua</option>
                      <option value="7days">7 ngày qua</option>
                      <option value="30days">30 ngày qua</option>
                      <option value="custom">Tùy chọn</option>
                    </Select>
                  </div>
                  <DateRangePicker
                    from={from}
                    to={to}
                    onChange={(start, end) => {
                      setFrom(start);
                      setTo(end);
                      setPreset("custom");
                    }}
                  />
                  <div className="filter-select">
                    <Select
                      aria-label="Lọc nhân viên"
                      value={employee}
                      onChange={(event) => setEmployee(event.target.value)}
                    >
                      <option value="">Tất cả nhân viên</option>
                      {data?.users
                        .filter((user) =>
                          data.fanpages.some((page) =>
                            page.employeeIds.includes(user.id),
                          ),
                        )
                        .map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                    </Select>
                  </div>
                  <div className="filter-select">
                    <Select
                      aria-label="Lọc Fanpage"
                      value={page}
                      onChange={(event) => setPage(event.target.value)}
                    >
                      <option value="">Tất cả Fanpage</option>
                      {data?.fanpages.map((page) => (
                        <option key={page.id} value={page.id}>
                          {page.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </section>
              <EmployeePostCards
                data={data}
                posts={detailed}
                checks={manual}
                params={params}
                onReview={setReview}
              />
            </>
          )}
        </>
      )}
      {review && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-title"
          >
            <div className="modal-heading">
              <h2 id="review-title">Kiểm duyệt bài viết</h2>
              <button
                aria-label="Đóng kiểm duyệt"
                className="icon-btn"
                onClick={() => setReview(null)}
              >
                <X size={20} />
              </button>
            </div>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                if (
                  await run({
                    action: "review",
                    id: review.id,
                    status: review.status,
                    note: review.note,
                    employeeId: review.employeeId,
                  })
                )
                  setReview(null);
              }}
            >
              <label>
                Trạng thái
                <Select
                  value={review.status}
                  onChange={(event) =>
                    setReview({
                      ...review,
                      status: event.target.value as Post["status"],
                    })
                  }
                >
                  <option value="pending">Chờ duyệt</option>
                  <option value="approved">Đã duyệt</option>
                  <option value="flagged">Cần xem lại</option>
                </Select>
              </label>
              <label>
                Nhân viên phụ trách
                <Select
                  value={review.employeeId || ""}
                  onChange={(event) =>
                    setReview({
                      ...review,
                      employeeId: event.target.value || null,
                    })
                  }
                >
                  <option value="">Chưa phân công</option>
                  {data?.users
                    .filter((user) =>
                      data.fanpages
                        .find((page) => page.id === review.fanpageId)
                        ?.employeeIds.includes(user.id),
                    )
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                </Select>
              </label>
              <label>
                Ghi chú
                <textarea
                  rows={4}
                  maxLength={2000}
                  value={review.note}
                  onChange={(event) =>
                    setReview({ ...review, note: event.target.value })
                  }
                />
              </label>
              <div className="modal-actions">
                <button className="btn primary" disabled={busy}>
                  Lưu kiểm duyệt
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
function DailyChart({
  posts,
  checks,
  from,
  to,
}: {
  posts: Post[];
  checks: ManualCheck[];
  from: string;
  to: string;
}) {
  const days = Math.min(
    62,
    Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1),
  );
  const values = Array.from({ length: days }, (_, index) => {
    const date = shiftDay(from, index);
    return {
      date,
      count:
        posts.filter((post) => post.postDate === date).length +
        checks
          .filter((check) => check.date === date)
          .reduce((sum, check) => sum + (check.postCount ?? 0), 0),
    };
  });
  const max = Math.max(4, ...values.map((value) => value.count));
  return (
    <div className="daily-chart">
      <div className="chart-y">
        {[
          max,
          Math.round(max * 0.75),
          Math.round(max * 0.5),
          Math.round(max * 0.25),
          0,
        ].map((value, index) => (
          <span key={index}>{value}</span>
        ))}
      </div>
      <div className="chart-plot">
        <div className="chart-grid">
          {[0, 1, 2, 3, 4].map((index) => (
            <div key={index} />
          ))}
        </div>
        <div className="chart-bars">
          {values.map((value, index) => (
            <div className="bar-column" key={value.date}>
              <div
                className={`chart-bar ${index === values.length - 1 ? "last" : ""}`}
                style={{ height: `${(value.count / max) * 100}%` }}
                title={`${value.date}: ${value.count} bài`}
              >
                <span>{value.count}</span>
              </div>
              <small>
                {days <= 14 || index % Math.ceil(days / 10) === 0
                  ? `${value.date.slice(8)}/${value.date.slice(5, 7)}`
                  : ""}
              </small>
            </div>
          ))}
        </div>
      </div>
      {days === 62 && (
        <small>Hiển thị 62 ngày đầu; tổng số liệu vẫn tính toàn kỳ.</small>
      )}
    </div>
  );
}
