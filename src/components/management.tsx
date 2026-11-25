"use client";
import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ExternalLink,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Facebook,
  Users,
  Settings2,
} from "lucide-react";
import type { Fanpage, PublicUser, Snapshot, User } from "@/lib/types";
import { parsePageInput } from "@/lib/facebook";
import { roleLabel } from "./app-shell";
import { groupFanpages } from "@/lib/ui-data";
import { TrackingBadge } from "./status-badge";
import { Select } from "./ui/primitives";
export function pageHref(page: Pick<Fanpage, "url">) {
  try {
    const id = parsePageInput(page.url);
    return /^https?:/.test(page.url)
      ? page.url
      : `https://www.facebook.com/${id}`;
  } catch {
    return null;
  }
}
type Edit = {
  type: "page" | "user";
  id?: string;
  name: string;
  email: string;
  role: User["role"];
  password: string;
  facebookName: string;
  facebookUrl: string;
  facebookUserId: string;
  url: string;
  source: Fanpage["source"];
  token: string;
  employeeIds: string[];
  managerFacebookName: string;
  managerFacebookUrl: string;
  trackingStatus: string;
  topic: string;
  note: string;
};
const blank: Edit = {
  type: "page",
  name: "",
  email: "",
  role: "staff",
  password: "",
  facebookName: "",
  facebookUrl: "",
  facebookUserId: "",
  url: "",
  source: "manual",
  token: "",
  employeeIds: [],
  managerFacebookName: "",
  managerFacebookUrl: "",
  trackingStatus: "",
  topic: "",
  note: "",
};
export default function Management({
  data,
  run,
  busy,
  view = "pages",
}: {
  data: Snapshot;
  run: (body: unknown) => Promise<boolean>;
  busy: boolean;
  view?: "pages" | "users";
}) {
  const searchParams = useSearchParams();
  const admin = data.viewer.role === "admin";
  const [tab, setTab] = useState<string>(view);
  useEffect(() => setTab(view), [view]);
  const [search, setSearch] = useState("");
  const [employee, setEmployee] = useState("");
  const [filter, setFilter] = useState("all");
  const [pageNumber, setPageNumber] = useState(1);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState<Edit | null>(null);
  const [deletion, setDeletion] = useState<{
    action: string;
    id: string;
    name: string;
  } | null>(null);
  const [formError, setFormError] = useState("");
  useEffect(() => {
    setEmployee(searchParams.get("employee") || "");
  }, [searchParams]);
  useEffect(() => {
    setPageNumber(1);
  }, [search, employee, filter]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        if (document.querySelector(".select-popover")) return;
        setEdit(null);
        setDeletion(null);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [busy]);
  const pages = data.fanpages.filter(
    (page) =>
      (!employee || page.employeeIds.includes(employee)) &&
      (filter !== "missing" || !pageHref(page)) &&
      `${page.name} ${page.url} ${page.managerFacebookName || ""} ${page.topic || ""}`
        .toLocaleLowerCase("vi")
        .includes(search.toLocaleLowerCase("vi")),
  );
  const groups = groupFanpages(pages, data.users);
  useEffect(() => {
    setPageNumber((current) =>
      Math.min(current, Math.max(1, Math.ceil(groups.length / 5))),
    );
  }, [groups.length]);
  const users = data.users.filter((user) =>
    `${user.name} ${user.email} ${user.facebookName || ""}`
      .toLocaleLowerCase("vi")
      .includes(search.toLocaleLowerCase("vi")),
  );
  const openPage = (page?: Snapshot["fanpages"][number]) => {
    setFormError("");
    setEdit({
      ...blank,
      ...page,
      type: "page",
      token: "",
      employeeIds: page?.employeeIds || (admin ? [] : [data.viewer.id]),
    });
  };
  const openUser = (user?: PublicUser) => {
    setFormError("");
    setEdit({
      ...blank,
      ...user,
      type: "user",
      role: user?.role || "user",
      password: "",
      facebookName: user?.facebookName || "",
      facebookUrl: user?.facebookUrl || "",
      facebookUserId: user?.facebookUserId || "",
    });
  };
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!edit) return;
    setFormError("");
    if (edit.type === "page" && admin && !edit.employeeIds.length) {
      setFormError("Chọn ít nhất một nhân viên phụ trách.");
      return;
    }
    const body =
      edit.type === "user"
        ? {
            action: "saveUser",
            id: edit.id,
            name: edit.name,
            email: edit.email,
            role: edit.role,
            password: edit.password || undefined,
            facebookName: edit.facebookName,
            facebookUrl: edit.facebookUrl,
            facebookUserId: edit.facebookUserId,
          }
        : {
            action: "savePage",
            id: edit.id,
            name: edit.name,
            url: edit.url,
            source: edit.source,
            token: edit.token,
            ...(admin ? { employeeIds: edit.employeeIds } : {}),
            managerFacebookName: edit.managerFacebookName,
            managerFacebookUrl: edit.managerFacebookUrl,
            trackingStatus: edit.trackingStatus,
            topic: edit.topic,
            note: edit.note,
          };
    if (await run(body)) setEdit(null);
    else
      setFormError(
        "Chưa lưu được thay đổi. Xem thông báo lỗi phía trên trang và kiểm tra dữ liệu.",
      );
  }
  function field(
    label: string,
    key: keyof Edit,
    required = false,
    type = "text",
  ) {
    return (
      <label>
        {label}
        <input
          autoFocus={key === "name"}
          required={required}
          type={type}
          value={String(edit?.[key] || "")}
          onChange={(event) =>
            setEdit(
              (current) => current && { ...current, [key]: event.target.value },
            )
          }
          maxLength={key === "url" || key.endsWith("Url") ? 500 : 160}
          {...(type === "password" && key === "password"
            ? { minLength: 10 }
            : {})}
        />
      </label>
    );
  }
  return (
    <>
      {view !== "users" && (
        <div className="admin-tabs">
          <button
            className={tab === "pages" ? "selected" : ""}
            onClick={() => {
              setTab("pages");
              setSearch("");
            }}
          >
            <Facebook size={17} />
            Fanpage <span>{data.fanpages.length}</span>
          </button>
          {admin && (
            <>
              <button
                className={tab === "settings" ? "selected" : ""}
                onClick={() => setTab("settings")}
              >
                <Settings2 size={17} />
                Cấu hình
              </button>
            </>
          )}
        </div>
      )}
      {tab !== "settings" && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>
                {tab === "users"
                  ? "Danh sách User"
                  : admin
                    ? "Fanpage của toàn công ty"
                    : "Fanpage của tôi"}
              </h2>
              <p>
                {tab === "users"
                  ? "Admin quản lý tên, tài khoản đăng nhập, Facebook cá nhân và vai trò."
                  : "Tên Page, link, Facebook đang giữ Page và nhân viên phụ trách."}
              </p>
            </div>
            <button
              className="btn primary"
              onClick={() => (tab === "users" ? openUser() : openPage())}
            >
              <Plus size={16} />
              {tab === "users" ? "Thêm User" : "Thêm Fanpage"}
            </button>
          </div>
          <div className="management-tools">
            <div className="search-box">
              <Search size={17} />
              <input
                aria-label={tab === "users" ? "Tìm User" : "Tìm Fanpage"}
                placeholder={
                  tab === "users"
                    ? "Tìm tên, email, Facebook…"
                    : "Tìm Page, link, tên Facebook…"
                }
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            {tab === "pages" && (
              <>
                {admin && (
                  <Select
                    className="plain-select"
                    aria-label="Lọc người phụ trách"
                    value={employee}
                    onChange={(event) => setEmployee(event.target.value)}
                  >
                    <option value="">Tất cả nhân viên</option>
                    {data.users
                      .filter((user) => user.role !== "user")
                      .map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                  </Select>
                )}
                <Select
                  className="plain-select"
                  aria-label="Lọc tình trạng link"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                >
                  <option value="all">Tất cả link</option>
                  <option value="missing">Thiếu link / Cần sửa link</option>
                </Select>
              </>
            )}
          </div>
          {tab === "pages" && (
            <div className="group-toolbar">
              <span>Nhóm theo nhân viên phụ trách</span>
              <div>
                <button onClick={() => setCollapsed(new Set())}>
                  Mở tất cả
                </button>
                <button
                  onClick={() =>
                    setCollapsed(new Set(groups.map((group) => group.id)))
                  }
                >
                  Thu gọn tất cả
                </button>
              </div>
            </div>
          )}
          <div className="table-wrap">
            {tab === "users" ? (
              <table>
                <thead>
                  <tr>
                    <th>NHÂN VIÊN</th>
                    <th>TÀI KHOẢN ĐĂNG NHẬP</th>
                    <th>FACEBOOK CÁ NHÂN</th>
                    <th>VAI TRÒ</th>
                    <th>FANPAGE</th>
                    <th>THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <strong>{user.name}</strong>
                      </td>
                      <td>{user.email}</td>
                      <td>
                        {user.facebookUrl ? (
                          <a
                            className="text-link"
                            href={user.facebookUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {user.facebookName || "Mở Facebook"}
                            <ExternalLink size={14} />
                          </a>
                        ) : (
                          user.facebookName || (
                            <span className="muted">Chưa bổ sung</span>
                          )
                        )}
                      </td>
                      <td>
                        <span
                          className={`status ${user.role === "admin" ? "approved" : user.role === "staff" ? "staff-status" : "pending"}`}
                        >
                          {roleLabel(user.role)}
                        </span>
                      </td>
                      <td>
                        <Link
                          className="text-link"
                          href={`/admin?employee=${encodeURIComponent(user.id)}`}
                        >
                          {
                            data.fanpages.filter((page) =>
                              page.employeeIds.includes(user.id),
                            ).length
                          }{" "}
                          Fanpage
                        </Link>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="icon-btn"
                            aria-label={`Sửa nhân viên ${user.name}`}
                            onClick={() => openUser(user)}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            title={
                              user.role === "admin"
                                ? "Tài khoản Admin được bảo vệ, không thể xóa"
                                : "Xóa User"
                            }
                            disabled={user.role === "admin"}
                            className="icon-btn danger"
                            aria-label={`Xóa nhân viên ${user.name}`}
                            onClick={() =>
                              setDeletion({
                                action: "deleteUser",
                                id: user.id,
                                name: user.name,
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
            ) : (
              <table className="management-table">
                <thead>
                  <tr>
                    <th>FANPAGE / LINK</th>
                    <th>FACEBOOK GIỮ PAGE</th>
                    <th>CHỦ ĐỀ</th>
                    <th>TRẠNG THÁI</th>
                    <th>THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {groups
                    .slice((pageNumber - 1) * 5, pageNumber * 5)
                    .map((group) => (
                      <Fragment key={group.id}>
                        <tr className="employee-group-row">
                          <td colSpan={5}>
                            <button
                              className="employee-group-toggle"
                              aria-expanded={!collapsed.has(group.id)}
                              onClick={() =>
                                setCollapsed((current) => {
                                  const next = new Set(current);
                                  next.has(group.id)
                                    ? next.delete(group.id)
                                    : next.add(group.id);
                                  return next;
                                })
                              }
                            >
                              <ChevronDown
                                size={17}
                                style={{
                                  transform: collapsed.has(group.id)
                                    ? "rotate(-90deg)"
                                    : undefined,
                                }}
                              />
                              <span className="avatar">
                                {group.name.slice(0, 2)}
                              </span>
                              <strong>{group.name}</strong>
                              <small>{group.pages.length} Fanpage</small>
                            </button>
                          </td>
                        </tr>
                        {!collapsed.has(group.id) &&
                          group.pages.map((page) => (
                            <tr key={page.id} className="page-data-row">
                              <td data-label="Fanpage / Link">
                                <strong>{page.name}</strong>
                                {pageHref(page) ? (
                                  <a
                                    className="page-url"
                                    href={pageHref(page)!}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {page.pageId || "Mở Fanpage"}
                                    <ExternalLink size={13} />
                                  </a>
                                ) : (
                                  <span className="block warning-text">
                                    {page.url
                                      ? "Link không phải Fanpage · Cần sửa"
                                      : "Chưa có link Fanpage"}
                                  </span>
                                )}
                                {page.note && (
                                  <small className="block">{page.note}</small>
                                )}
                              </td>
                              <td data-label="Facebook giữ Page">
                                {page.managerFacebookName || (
                                  <span className="muted">Chưa bổ sung</span>
                                )}
                                {page.managerFacebookUrl && (
                                  <a
                                    className="page-url"
                                    href={page.managerFacebookUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Mở tài khoản <ExternalLink size={13} />
                                  </a>
                                )}
                              </td>
                              <td data-label="Chủ đề">{page.topic || "—"}</td>
                              <td data-label="Trạng thái">
                                <TrackingBadge value={page.trackingStatus} />
                                <small className="block">
                                  {page.source === "manual"
                                    ? "Thủ công / Excel"
                                    : page.source === "mock"
                                      ? "Mẫu"
                                      : "Facebook API"}
                                </small>
                              </td>
                              <td data-label="Thao tác">
                                <div className="row-actions">
                                  <button
                                    className="icon-btn"
                                    aria-label={`Sửa Fanpage ${page.name}`}
                                    onClick={() => openPage(page)}
                                  >
                                    <Pencil size={16} />
                                  </button>
                                  {admin && page.source === "facebook" && (
                                    <button
                                      className="icon-btn"
                                      disabled={busy}
                                      aria-label={`Đồng bộ ${page.name}`}
                                      onClick={() =>
                                        void run({
                                          action: "sync",
                                          id: page.id,
                                        })
                                      }
                                    >
                                      <RefreshCw size={16} />
                                    </button>
                                  )}
                                  <button
                                    className="icon-btn danger"
                                    aria-label={`Xóa Fanpage ${page.name}`}
                                    onClick={() =>
                                      setDeletion({
                                        action: "deletePage",
                                        id: page.id,
                                        name: page.name,
                                      })
                                    }
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </Fragment>
                    ))}
                </tbody>
              </table>
            )}
          </div>
          {(tab === "pages" ? !pages.length : !users.length) && (
            <div className="empty">Không tìm thấy dữ liệu phù hợp.</div>
          )}
          {tab === "pages" && (
            <div className="table-footer">
              <span>
                {pages.length} Fanpage · {groups.length} nhóm nhân viên · 5 nhóm
                / trang
              </span>
              <div className="pagination">
                <button
                  className="icon-btn"
                  aria-label="Trang Fanpage trước"
                  disabled={pageNumber === 1}
                  onClick={() => setPageNumber(pageNumber - 1)}
                >
                  <ChevronLeft size={17} />
                </button>
                <span>
                  {pageNumber}/{Math.max(1, Math.ceil(groups.length / 5))}
                </span>
                <button
                  className="icon-btn"
                  aria-label="Trang Fanpage sau"
                  disabled={pageNumber * 5 >= groups.length}
                  onClick={() => setPageNumber(pageNumber + 1)}
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
          )}
        </section>
      )}
      {tab === "settings" && admin && (
        <section className="panel settings-panel">
          <h2>Phân quyền workspace</h2>
          <div className="role-grid">
            <div>
              <strong>Admin</strong>
              <p>Quản lý toàn bộ tài khoản, Fanpage, dữ liệu và cấu hình.</p>
            </div>
            <div>
              <strong>Staff</strong>
              <p>
                Thêm, sửa, xóa Fanpage được giao. Không thay đổi quyền hoặc nhân
                viên phụ trách.
              </p>
            </div>
            <div>
              <strong>User</strong>
              <p>Chỉ xem tên nhân viên và tổng số bài của mọi người.</p>
            </div>
          </div>
          <div className="setting-row">
            <div>
              <strong>Cho phép đồng bộ cuối ngày</strong>
              <p>Cần scheduler gọi endpoint cron lúc 23:55 Việt Nam.</p>
            </div>
            <input
              type="checkbox"
              aria-label="Bật cron"
              checked={data.settings.cronEnabled}
              disabled={busy}
              onChange={(event) =>
                void run({
                  action: "settings",
                  settings: { cronEnabled: event.target.checked },
                })
              }
            />
          </div>
          <div className="mode-banner">
            Dữ liệu công ty được tách khỏi Page mẫu. Không nhập số liệu mẫu vào
            tổng của công ty.
          </div>
        </section>
      )}
      {edit && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-title"
          >
            <div className="modal-heading">
              <h2 id="edit-title">
                {edit.id ? "Chỉnh sửa" : "Thêm"}{" "}
                {edit.type === "user" ? "User" : "Fanpage"}
              </h2>
              <button
                className="icon-btn"
                aria-label="Đóng form"
                disabled={busy}
                onClick={() => setEdit(null)}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={save}>
              {field(
                edit.type === "user" ? "Họ và tên" : "Tên Fanpage",
                "name",
                true,
              )}
              {edit.type === "user" ? (
                <>
                  {field("Tài khoản đăng nhập (email)", "email", true, "email")}
                  <label>
                    Vai trò
                    <Select
                      disabled={Boolean(
                        edit.id &&
                        data.users.find((user) => user.id === edit.id)?.role ===
                          "admin",
                      )}
                      value={edit.role}
                      onChange={(event) =>
                        setEdit({
                          ...edit,
                          role: event.target.value as User["role"],
                        })
                      }
                    >
                      <option value="staff">
                        Staff · CRUD Fanpage của mình
                      </option>
                      <option value="user">User · Chỉ xem tổng số bài</option>
                      <option value="admin">Admin · Quản lý tất cả</option>
                    </Select>
                  </label>
                  {field(
                    edit.id
                      ? "Mật khẩu mới (trống = giữ nguyên)"
                      : "Mật khẩu (ít nhất 10 ký tự)",
                    "password",
                    !edit.id,
                    "password",
                  )}
                  {field("Tên Facebook cá nhân (nếu có)", "facebookName")}
                  {field(
                    "Link Facebook cá nhân (nếu có)",
                    "facebookUrl",
                    false,
                    "url",
                  )}
                  {field(
                    "Facebook User ID (đối chiếu người đăng)",
                    "facebookUserId",
                  )}
                </>
              ) : (
                <>
                  {field(
                    "Link Fanpage hoặc Page ID (có thể bổ sung sau)",
                    "url",
                    edit.source !== "manual",
                  )}
                  {field(
                    "Tên Facebook đang giữ Fanpage",
                    "managerFacebookName",
                  )}
                  {field(
                    "Link Facebook đang giữ Fanpage",
                    "managerFacebookUrl",
                    false,
                    "url",
                  )}
                  <label>
                    Nguồn dữ liệu
                    <Select
                      value={edit.source}
                      onChange={(event) =>
                        setEdit({
                          ...edit,
                          source: event.target.value as Fanpage["source"],
                        })
                      }
                    >
                      <option value="manual">Theo dõi thủ công / Excel</option>
                      <option value="facebook">Facebook Graph API</option>
                      {edit.source === "mock" && (
                        <option value="mock">Dữ liệu mẫu</option>
                      )}
                    </Select>
                  </label>
                  {edit.source === "facebook" && (
                    <label>
                      Page Access Token
                      <input
                        type="password"
                        autoComplete="off"
                        value={edit.token}
                        required={
                          !edit.id ||
                          data.fanpages.find((page) => page.id === edit.id)
                            ?.source !== "facebook"
                        }
                        onChange={(event) =>
                          setEdit({ ...edit, token: event.target.value })
                        }
                      />
                      <small>
                        Để trống để giữ token đã lưu. Token không được trả về
                        trình duyệt.
                      </small>
                    </label>
                  )}
                  {field("Chủ đề", "topic")}
                  {field("Tình trạng Fanpage", "trackingStatus")}
                  <label>
                    Ghi chú
                    <textarea
                      rows={3}
                      maxLength={2000}
                      value={edit.note}
                      onChange={(event) =>
                        setEdit({ ...edit, note: event.target.value })
                      }
                    />
                  </label>
                  {admin ? (
                    <>
                      <label>Nhân viên phụ trách</label>
                      <div className="checkbox-list">
                        {data.users
                          .filter((user) => user.role !== "user")
                          .map((user) => (
                            <label key={user.id}>
                              <input
                                type="checkbox"
                                checked={edit.employeeIds.includes(user.id)}
                                onChange={(event) =>
                                  setEdit({
                                    ...edit,
                                    employeeIds: event.target.checked
                                      ? [...edit.employeeIds, user.id]
                                      : edit.employeeIds.filter(
                                          (id) => id !== user.id,
                                        ),
                                  })
                                }
                              />
                              {user.name}
                            </label>
                          ))}
                      </div>
                    </>
                  ) : (
                    <div className="mode-banner">
                      Fanpage mới được gán cho bạn. Chỉ Admin được thay đổi
                      người phụ trách.
                    </div>
                  )}
                </>
              )}
              {formError && (
                <div role="alert" className="error">
                  {formError}
                </div>
              )}
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => setEdit(null)}
                >
                  Hủy
                </button>
                <button className="btn primary" disabled={busy}>
                  {busy
                    ? "Đang lưu…"
                    : edit.type === "page" && edit.source === "facebook"
                      ? admin
                        ? "Test Connection & Sync Now"
                        : "Test Connection & Lưu"
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
                ? "Bài viết và các dòng check thủ công của Fanpage này cũng sẽ bị xóa."
                : "Bài viết và các dòng check cũ được giữ lại dưới mục Chưa phân công."}
            </p>
            <div className="modal-actions">
              <button
                className="btn"
                disabled={busy}
                onClick={() => setDeletion(null)}
              >
                Hủy
              </button>
              <button
                className="btn destructive"
                disabled={busy}
                onClick={async () => {
                  if (await run(deletion)) setDeletion(null);
                }}
              >
                Xóa
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
