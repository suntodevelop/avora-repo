"use client";
import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Pencil,
  Users,
} from "lucide-react";
import type { Snapshot, Post, ManualCheck } from "@/lib/types";
import { dateSynced } from "@/lib/time";

import { pageHref } from "./management";
import StatusBadge, { TrackingBadge } from "./status-badge";
import { ScrollArea } from "./ui/primitives";
const num = (n: number) => n.toLocaleString("vi-VN");
export default function EmployeePostCards({
  data,
  posts,
  checks,
  params,
  onReview,
}: {
  data: Snapshot;
  posts: Post[];
  checks: ManualCheck[];
  params: URLSearchParams;
  onReview: (post: Post) => void;
}) {
  const [page, setPage] = useState(1);
  const date = params.get("from");
  const zeroPages =
    date && date === params.get("to") && !params.get("q")
      ? data.fanpages.filter(
          (p) =>
            p.source === "facebook" &&
            dateSynced(p, date) &&
            (!params.get("page") || p.id === params.get("page")) &&
            !data.posts.some(
              (post) => post.fanpageId === p.id && post.postDate === date,
            ),
        )
      : [];
  const people = [
    ...new Set([
      ...checks.map((c) => c.employeeId),
      ...posts.map((p) => p.employeeId),
      ...zeroPages.flatMap((p) =>
        p.employeeIds.filter(
          (id) => !params.get("employee") || id === params.get("employee"),
        ),
      ),
    ]),
  ];
  const groups = people
    .map((id) => ({
      id,
      name: data.users.find((u) => u.id === id)?.name || "Chưa phân công",
      posts: posts.filter((p) => p.employeeId === id),
      checks: checks.filter((c) => c.employeeId === id),
      zeroPages: zeroPages.filter((p) => !!id && p.employeeIds.includes(id)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  const signature =
    checks.map((c) => c.id).join("|") + posts.map((p) => p.id).join("|");
  useEffect(() => setPage(1), [signature]);
  return (
    <div className="employee-post-cards">
      {!groups.length && (
        <section className="panel empty">
          <FileText size={24} />
          <div>
            <strong>Chưa có bài trong khoảng ngày này</strong>
            <p>Chọn Ngày mới nhất có dữ liệu hoặc thay đổi bộ lọc.</p>
          </div>
        </section>
      )}
      {groups.slice((page - 1) * 8, page * 8).map((group) => (
        <EmployeeCard
          key={group.id || "unassigned"}
          group={group}
          data={data}
          onReview={onReview}
        />
      ))}
      {groups.length > 8 && (
        <div className="table-footer panel">
          <span>{groups.length} nhân viên · 8 card / trang</span>
          <div className="pagination">
            <button
              className="icon-btn"
              aria-label="Trang nhân viên trước"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={17} />
            </button>
            <span>
              {page}/{Math.ceil(groups.length / 8)}
            </span>
            <button
              className="icon-btn"
              aria-label="Trang nhân viên sau"
              disabled={page * 8 >= groups.length}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
function EmployeeCard({
  group,
  data,
  onReview,
}: {
  group: {
    id: string | null;
    name: string;
    posts: Post[];
    checks: ManualCheck[];
    zeroPages: Snapshot["fanpages"];
  };
  data: Snapshot;
  onReview: (post: Post) => void;
}) {
  const [page, setPage] = useState(1);
  const size = 8;
  const [collapsed, setCollapsed] = useState(false);
  const rows = [
    ...group.checks.map((check) => ({
      id: check.id,
      check,
      post: null as Post | null,
    })),
    ...group.posts.map((post) => ({
      id: post.id,
      check: null as ManualCheck | null,
      post,
    })),
  ];
  const signature = rows.map((r) => r.id).join("|");
  useEffect(() => setPage(1), [signature, size]);
  const total =
      group.posts.length +
      group.checks.reduce((sum, c) => sum + (c.postCount ?? 0), 0),
    missing = group.checks.filter((c) => c.postCount === null).length;
  const pageIds = new Set([
    ...group.posts.map((p) => p.fanpageId),
    ...group.checks.map((c) => c.fanpageId),
    ...group.zeroPages.map((p) => p.id),
  ]);
  return (
    <section className="panel employee-post-card">
      <header className="employee-card-header">
        <div>
          <span className="avatar">
            <Users size={18} />
          </span>
          <div>
            <h2>{group.name}</h2>
            <p>
              {pageIds.size} Fanpage
              {missing > 0 ? ` · ${missing} mục chưa có số bài` : ""}
            </p>
          </div>
        </div>
        <div className="employee-card-total">
          <strong>
            {group.posts.length ||
            group.checks.some((check) => check.postCount !== null) ||
            group.zeroPages.length > 0
              ? num(total)
              : "—"}
          </strong>
          <span>bài ghi nhận</span>
        </div>
        <button
          className="icon-btn card-collapse"
          aria-label={`${collapsed ? "Mở rộng" : "Thu gọn"} bài viết ${group.name}`}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
        >
          <ChevronDown
            size={18}
            style={{ transform: collapsed ? "rotate(-90deg)" : undefined }}
          />
        </button>
      </header>
      {!collapsed && (
        <>
          {group.zeroPages.map((p) => (
            <div className="sync-zero-page" key={p.id}>
              <strong>{p.name}</strong>
              <span>0 bài đăng · Đã kiểm tra Facebook trong ngày đã chọn</span>
            </div>
          ))}
          <ScrollArea className="table-wrap">
            <table className="employee-post-table">
              <thead>
                <tr>
                  <th>NGÀY / GIỜ</th>
                  <th>FANPAGE / NỘI DUNG</th>
                  <th className="number">SỐ BÀI</th>
                  <th className="number">LIKE</th>
                  <th className="number">COMMENT</th>
                  <th className="number">SHARE</th>
                  <th>TRẠNG THÁI / GHI CHÚ</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .slice((page - 1) * size, page * size)
                  .map(({ id, check, post }) => {
                    const item = check || post!,
                      fanpage = data.fanpages.find(
                        (p) => p.id === item.fanpageId,
                      );
                    return (
                      <tr key={id}>
                        <td>
                          {(check?.date || post!.postDate)
                            .split("-")
                            .reverse()
                            .join("/")}
                          {post && (
                            <small className="block">
                              {new Intl.DateTimeFormat("vi-VN", {
                                timeZone: "Asia/Ho_Chi_Minh",
                                hour: "2-digit",
                                minute: "2-digit",
                              }).format(new Date(post.createdTime))}
                            </small>
                          )}
                        </td>
                        <td>
                          {fanpage && pageHref(fanpage) ? (
                            <a
                              className="text-link"
                              href={pageHref(fanpage)!}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {fanpage.name}
                              <ExternalLink size={12} />
                            </a>
                          ) : (
                            fanpage?.name
                          )}
                          {post && (
                            <a
                              className="post-link"
                              href={post.permalinkUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <span>{post.message}</span>
                              <ExternalLink size={12} />
                            </a>
                          )}
                          <div className="block">
                            <TrackingBadge value={fanpage?.trackingStatus} />
                          </div>
                        </td>
                        <td className="number total-cell">
                          {check ? (
                            check.postCount === null ? (
                              <StatusBadge tone="warning">
                                {check.postCountRaw || "Chưa có"}
                              </StatusBadge>
                            ) : (
                              num(check.postCount)
                            )
                          ) : (
                            "1"
                          )}
                        </td>
                        <td className="number">
                          {post && post.likesAvailable !== false
                            ? num(post.likes)
                            : "—"}
                        </td>
                        <td className="number">
                          {check
                            ? check.commentCount === null
                              ? "—"
                              : num(check.commentCount)
                            : post!.commentsAvailable !== false
                              ? num(post!.comments)
                              : "—"}
                        </td>
                        <td className="number">
                          {post ? num(post.shares) : "—"}
                        </td>
                        <td>
                          {check ? (
                            <StatusBadge
                              tone={check.checked ? "success" : "neutral"}
                            >
                              {check.checked
                                ? "Đã check"
                                : "Chưa đánh dấu check"}
                            </StatusBadge>
                          ) : (
                            <button
                              className={`status ${post!.status}`}
                              disabled={data.viewer.role !== "admin"}
                              onClick={() => onReview({ ...post! })}
                            >
                              {post!.status === "approved"
                                ? "Đã duyệt"
                                : post!.status === "flagged"
                                  ? "Cần xem lại"
                                  : "Chờ duyệt"}
                              {data.viewer.role === "admin" && (
                                <Pencil size={12} />
                              )}
                            </button>
                          )}
                          {item.note && (
                            <small className="block">{item.note}</small>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </ScrollArea>
          {rows.length > 8 && (
            <div className="table-footer">
              <span>{rows.length} mục · 8 mục / trang</span>
              <div className="pagination">
                <button
                  className="icon-btn"
                  aria-label={`Trang trước của ${group.name}`}
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <span>
                  {page}/{Math.ceil(rows.length / size)}
                </span>
                <button
                  className="icon-btn"
                  aria-label={`Trang sau của ${group.name}`}
                  disabled={page * size >= rows.length}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
