"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  FileText,
  Settings2,
  LogOut,
  ShieldCheck,
  UsersRound,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  UserRound,
} from "lucide-react";
import type { PublicUser } from "@/lib/types";
import Brand from "./brand";
import { AppearanceControl } from "./appearance";
import ProfileDialog, { Avatar } from "./profile-dialog";
export const roleLabel = (role?: string) =>
  role === "admin"
    ? "Admin · Quản trị viên"
    : role === "staff"
      ? "Staff · Nhân viên"
      : role === "user"
        ? "User · Chỉ xem tổng số bài"
        : "Đang tải…";
export default function AppShell({
  viewer,
  children,
}: {
  viewer: PublicUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const section =
    pathname === "/posts"
      ? "posts"
      : pathname === "/users"
        ? "users"
        : pathname === "/admin"
          ? "admin"
          : pathname === "/staff"
            ? "staff"
            : "dashboard";
  const [collapsed, setCollapsed] = useState(false),
    [menu, setMenu] = useState(false),
    [profile, setProfile] = useState(false),
    [identity, setIdentity] = useState<PublicUser>(viewer),
    [notice, setNotice] = useState("");
  const menuRoot = useRef<HTMLDivElement>(null);
  useEffect(() => setIdentity(viewer), [viewer]);
  const manager = viewer?.role === "admin" || viewer?.role === "staff",
    displayUser = identity || viewer;
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("avora-sidebar") === "collapsed");
    } catch {}
    const refreshProfile = () => {
      void fetch("/api/profile", { cache: "no-store" })
        .then(async (response) => {
          if (response.ok) setIdentity(await response.json());
        })
        .catch(() => {});
    };
    window.addEventListener("avora-profile-updated", refreshProfile);
    return () =>
      window.removeEventListener("avora-profile-updated", refreshProfile);
  }, []);
  useEffect(() => {
    setMenu(false);
  }, [pathname]);
  useEffect(() => {
    if (viewer?.role)
      document.title = `AVORA MEDIA - ${viewer.role === "admin" ? "Admin" : viewer.role === "staff" ? "Staff" : "User"}`;
  }, [viewer?.role, section]);
  useEffect(() => {
    if (!menu) return;
    const outside = (e: PointerEvent) => {
        if (!menuRoot.current?.contains(e.target as Node)) setMenu(false);
      },
      escape = (e: KeyboardEvent) => {
        if (e.key === "Escape") setMenu(false);
      };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [menu]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    window.location.assign("/login");
  }
  const label =
    section === "dashboard"
      ? "Tổng quan"
      : section === "posts"
        ? "Bài viết"
        : section === "users"
          ? "Quản lý User"
          : "Quản lý bài đăng";
  return (
    <div
      data-testid="workspace-shell"
      className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}
    >
      <aside className="sidebar" data-testid="workspace-sidebar">
        <div className="sidebar-brand">
          <Brand />
          <button
            className="icon-btn sidebar-toggle"
            aria-label={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
            title={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
            onClick={() => {
              setCollapsed(!collapsed);
              try {
                localStorage.setItem(
                  "avora-sidebar",
                  collapsed ? "expanded" : "collapsed",
                );
              } catch {}
            }}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
          </button>
        </div>
        <div className="nav-caption">KHÔNG GIAN LÀM VIỆC</div>
        <nav>
          <Link
            href="/"
            title="Tổng quan"
            aria-label="Tổng quan"
            className={section === "dashboard" ? "active" : ""}
          >
            <LayoutDashboard size={20} />
            <span>Tổng quan</span>
          </Link>
          {manager && (
            <Link
              href="/posts"
              title="Bài viết"
              aria-label="Bài viết"
              className={section === "posts" ? "active" : ""}
            >
              <FileText size={20} />
              <span>Bài viết</span>
            </Link>
          )}
          {manager && (
            <Link
              href={viewer?.role === "admin" ? "/admin" : "/staff"}
              title="Quản lý bài đăng"
              aria-label="Quản lý bài đăng"
              className={["admin", "staff"].includes(section) ? "active" : ""}
            >
              <Settings2 size={20} />
              <span>Quản lý bài đăng</span>
            </Link>
          )}
          {viewer?.role === "admin" && (
            <Link
              href="/users"
              title="Quản lý User"
              aria-label="Quản lý User"
              className={section === "users" ? "active" : ""}
            >
              <UsersRound size={20} />
              <span>Quản lý User</span>
            </Link>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="sync-note">
            <ShieldCheck size={23} />
            <strong>{roleLabel(viewer?.role)}</strong>
            <p>
              {viewer?.role === "admin"
                ? "Quản lý nhân sự, Fanpage và số liệu toàn công ty."
                : viewer?.role === "staff"
                  ? "Quản lý Fanpage được giao và theo dõi nội dung."
                  : "Xem tổng số bài của mọi người trong công ty."}
            </p>
          </div>
          <div className="sidebar-identity">
            <Avatar user={displayUser} />
            <span>
              {displayUser?.name || "Đang tải…"}
              <small>{roleLabel(viewer?.role)}</small>
            </span>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar" data-testid="workspace-topbar">
          <div>
            <span className="mobile-brand">
              <Brand compact />
            </span>
            <span className="breadcrumb-company">
              AVORA MEDIA <span>/</span>
            </span>
            <strong>{label}</strong>
          </div>
          <div className="topbar-right">
            <AppearanceControl />
            <div className="user-menu-root" ref={menuRoot}>
              <button
                className="user-menu-trigger"
                aria-label="Menu tài khoản"
                aria-expanded={menu}
                aria-haspopup="menu"
                onClick={() => setMenu(!menu)}
              >
                <Avatar user={displayUser} />
                <span>
                  {displayUser?.name || "Tài khoản"}
                  <small>
                    {viewer?.role === "admin"
                      ? "Admin"
                      : viewer?.role === "staff"
                        ? "Staff"
                        : "User"}
                  </small>
                </span>
                <ChevronDown size={14} />
              </button>
              {menu && (
                <div className="user-menu" role="menu" aria-label="Tài khoản">
                  <div>
                    <strong>{displayUser?.name}</strong>
                    <small>{identity?.email}</small>
                  </div>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setMenu(false);
                      setProfile(true);
                    }}
                  >
                    <UserRound size={17} />
                    Hồ sơ cá nhân
                  </button>
                  <button
                    role="menuitem"
                    className="danger"
                    onClick={() => void logout()}
                  >
                    <LogOut size={17} />
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="page-content">
          {notice && (
            <div className="notice success" role="status">
              {notice}
            </div>
          )}
          {children}
          <footer className="app-footer">
            <span>AVORA MEDIA · Content Workspace</span>
            <span>{roleLabel(viewer?.role)}</span>
          </footer>
        </div>
      </main>
      {profile && (
        <ProfileDialog
          onClose={() => setProfile(false)}
          onSaved={(user) => {
            setIdentity(user);
            setNotice("Đã cập nhật hồ sơ cá nhân.");
            window.dispatchEvent(new Event("avora-profile-updated"));
          }}
        />
      )}
    </div>
  );
}
