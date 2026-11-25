"use client";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, RefreshCw, X, CircleAlert } from "lucide-react";
import type { Snapshot } from "@/lib/types";
import { todayVN } from "@/lib/time";
import { Select, ScrollArea } from "./ui/primitives";

type Result = {
  page: string;
  pageId: string;
  count: number;
  status: "success" | "skipped" | "error";
  error?: string;
};
export default function FacebookSyncDialog({
  data,
  pageId,
  employeeId,
  onClose,
  onComplete,
}: {
  data: Snapshot;
  pageId: string;
  employeeId: string;
  onClose: () => void;
  onComplete: (date: string, employee: string, page: string) => Promise<void>;
}) {
  const [date, setDate] = useState(todayVN());
  const [employee, setEmployee] = useState(employeeId);
  const [page, setPage] = useState(pageId);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState("");
  const [started, setStarted] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const pages = data.fanpages.filter(
    (p) =>
      (!employee || p.employeeIds.includes(employee)) &&
      (!page || p.id === page),
  );
  const connected = pages.filter((p) => p.source !== "manual");
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    root.current?.focus();
    return () => previous?.focus();
  }, []);
  async function sync() {
    setBusy(true);
    setStarted(true);
    setResults([]);
    setError("");
    // One request per Page gives real progress and isolates failures. At most 3 Facebook requests run concurrently.
    const queue = [...connected];
    setResults(
      pages
        .filter((p) => p.source === "manual")
        .map((p) => ({
          page: p.name,
          pageId: p.id,
          count: 0,
          status: "skipped",
          error:
            "Chưa có kết nối Facebook. Thêm Page Access Token trong Quản lý bài đăng.",
        })),
    );
    try {
      await Promise.all(
        Array.from({ length: Math.min(3, queue.length) }, async () => {
          while (queue.length) {
            const item = queue.shift()!;
            try {
              const response = await fetch("/api/data", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "sync", id: item.id, date }),
              });
              const body = await response.json();
              if (!response.ok)
                throw new Error(body.error || "Không thể đồng bộ");
              setResults((old) => [...old, ...body.results]);
            } catch (e) {
              setResults((old) => [
                ...old,
                {
                  page: item.name,
                  pageId: item.id,
                  count: 0,
                  status: "error",
                  error: e instanceof Error ? e.message : "Lỗi kết nối",
                },
              ]);
            }
          }
        }),
      );
      if (connected.length) await onComplete(date, employee, page);
    } catch {
      setError("Không thể tải lại báo cáo. Hãy tải lại trang.");
    } finally {
      setBusy(false);
    }
  }
  const succeeded = results.filter((r) => r.status === "success");
  return (
    <div className="modal-backdrop">
      <div
        ref={root}
        tabIndex={-1}
        className="modal facebook-sync-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sync-title"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) onClose();
          if (event.key === "Tab") {
            const items = root.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input:not(:disabled), [role="combobox"]:not([aria-disabled="true"])',
            );
            const first = items?.[0],
              last = items?.[items.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <div className="modal-heading">
          <div>
            <h2 id="sync-title">Đồng bộ Facebook theo ngày</h2>
            <p>Kiểm tra bài đăng và cập nhật Like, Comment, Share.</p>
          </div>
          <button
            className="icon-btn"
            aria-label="Đóng đồng bộ"
            disabled={busy}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void sync();
          }}
        >
          <label>
            Ngày kiểm tra (giờ Việt Nam)
            <input
              type="date"
              required
              max={todayVN()}
              value={date}
              disabled={busy}
              onChange={(event) => {
                setDate(event.target.value);
                setStarted(false);
              }}
            />
          </label>
          <div className="form-grid">
            <label>
              Nhân viên
              <Select
                value={employee}
                disabled={busy}
                onChange={(event) => {
                  setEmployee(event.target.value);
                  setPage("");
                  setStarted(false);
                }}
              >
                <option value="">Tất cả nhân viên</option>
                {data.users
                  .filter((u) =>
                    data.fanpages.some((p) => p.employeeIds.includes(u.id)),
                  )
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
              </Select>
            </label>
            <label>
              Fanpage
              <Select
                value={page}
                disabled={busy}
                onChange={(event) => {
                  setPage(event.target.value);
                  setStarted(false);
                }}
              >
                <option value="">Tất cả Fanpage</option>
                {data.fanpages
                  .filter((p) => !employee || p.employeeIds.includes(employee))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </Select>
            </label>
          </div>
          <div className="sync-scope">
            <strong>
              {connected.length} / {pages.length} Fanpage đã kết nối
            </strong>
            <p>
              {pages.length - connected.length} Fanpage chưa kết nối sẽ được bỏ
              qua. Số liệu thủ công của các ngày khác được giữ nguyên.
            </p>
            {connected.some((p) => p.source === "mock") && (
              <p>Fanpage thử nghiệm sử dụng dữ liệu mô phỏng.</p>
            )}
          </div>
          {started && (
            <section aria-live="polite" className="sync-results">
              <strong>
                {busy
                  ? `Đã xử lý ${results.length}/${pages.length} Fanpage`
                  : `Hoàn tất: ${succeeded.length} thành công · ${results.filter((r) => r.status === "error").length} lỗi · ${results.filter((r) => r.status === "skipped").length} chưa kết nối`}
              </strong>
              <p>
                {succeeded.length
                  ? succeeded.reduce((n, r) => n + r.count, 0) +
                    " bài đăng được ghi nhận ngày " +
                    date.split("-").reverse().join("/")
                  : "Chưa có Fanpage nào đồng bộ thành công. Chưa thể xác định số bài trong ngày."}
              </p>
              <ScrollArea className="sync-result-list">
                {results.map((r) => (
                  <div key={r.pageId} className={`sync-result ${r.status}`}>
                    <span>
                      {r.status === "success" ? (
                        <CheckCircle2 size={16} />
                      ) : (
                        <CircleAlert size={16} />
                      )}
                    </span>
                    <div>
                      <strong>{r.page}</strong>
                      <small>
                        {r.status === "success"
                          ? `${r.count} bài đăng · Đã cập nhật chỉ số`
                          : r.error}
                      </small>
                    </div>
                  </div>
                ))}
              </ScrollArea>
            </section>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button
              className="btn"
              type="button"
              disabled={busy}
              onClick={onClose}
            >
              Đóng
            </button>
            <button
              className="btn primary"
              disabled={busy || !pages.length || !date}
            >
              <RefreshCw size={16} className={busy ? "spin" : ""} />
              {busy
                ? "Đang đồng bộ…"
                : started
                  ? "Đồng bộ lại"
                  : "Đồng bộ ngày đã chọn"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
