"use client";
import { useEffect, useState } from "react";
import { CalendarDays, FileText, Users, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { todayVN, shiftDay } from "@/lib/time";
import type { CountSummary } from "@/lib/types";
import DonutChart from "./donut-chart";
import DateRangePicker from "./ui/date-range-picker";
import { Select } from "./ui/primitives";
import PageHeading from "./ui/page-heading";
export default function SummaryDashboard() {
  const router = useRouter();
  const [preset, setPreset] = useState("7days");
  const [from, setFrom] = useState(shiftDay(todayVN(), -6));
  const [to, setTo] = useState(todayVN());
  const [data, setData] = useState<CountSummary>();
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    fetch(`/api/summary?${new URLSearchParams({ from, to })}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setData(result);
      })
      .catch((error) => {
        if (error.name !== "AbortError")
          setError("Không thể tải tổng số bài. Vui lòng thử lại.");
      });
    return () => controller.abort();
  }, [from, to]);
  return (
    <>
      <PageHeading
        title="Tổng số bài đăng"
        description="Số lượng bài của mọi người trong khoảng thời gian đã chọn."
      />
      <div className="mode-banner">
        <Info size={18} />
        Tài khoản User chỉ xem số lượng bài. Thông tin Fanpage, tài khoản
        Facebook và bài viết chi tiết được giới hạn theo quyền.
      </div>
      <div className="filters">
        <div className="filter-select">
          <CalendarDays size={17} />
          <Select
            aria-label="Khoảng thời gian"
            value={preset}
            onChange={(event) => {
              const value = event.target.value;
              setPreset(value);
              if (value === "custom") return;
              const end =
                value === "yesterday" ? shiftDay(todayVN(), -1) : todayVN();
              setTo(end);
              setFrom(
                value === "7days"
                  ? shiftDay(end, -6)
                  : value === "30days"
                    ? shiftDay(end, -29)
                    : end,
              );
            }}
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
      </div>
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
      {data ? (
        <>
          <div className="summary-kpis">
            <div className="kpi">
              <div className="kpi-label">
                Tổng số bài đã ghi nhận
                <FileText size={20} />
              </div>
              <div className="kpi-value">
                {data.totalPosts.toLocaleString("vi-VN")}
                <small>bài</small>
              </div>
              <p className="block">Trong khoảng thời gian đã chọn</p>
            </div>
            <div className="kpi">
              <div className="kpi-label">
                Nhân viên trong báo cáo
                <Users size={20} />
              </div>
              <div className="kpi-value">
                {data.rows.length}
                <small>người</small>
              </div>
            </div>
          </div>
          {data.missingCounts > 0 && (
            <div className="mode-banner">
              Có {data.missingCounts} dòng chưa có số bài hợp lệ. Tổng chỉ gồm
              số lượng đã ghi nhận, không coi dữ liệu thiếu là 0.
            </div>
          )}
          <div className="summary-analytics">
            <DonutChart
              items={data.rows.map((row) => ({
                id: row.employeeId,
                label: row.name,
                value: row.posts,
              }))}
            />
          </div>
          <section className="panel">
            <div className="panel-heading">
              <h2>Số bài theo nhân viên</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>NHÂN VIÊN</th>
                    <th className="number">TỔNG SỐ BÀI</th>
                    <th>GHI NHẬN</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.employeeId}>
                      <td>
                        <strong>{row.name}</strong>
                      </td>
                      <td className="number">
                        <span className="total-cell">
                          {row.hasCounts
                            ? row.posts.toLocaleString("vi-VN")
                            : "Chưa có số liệu"}
                        </span>
                      </td>
                      <td>
                        {row.missingCounts
                          ? `${row.missingCounts} dòng chưa đủ số liệu`
                          : "Đã có số lượng"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.rows.length && (
                <div className="empty">
                  Chưa có dữ liệu trong khoảng ngày này.
                </div>
              )}
            </div>
          </section>
        </>
      ) : (
        <div className="empty">Đang tải tổng số bài…</div>
      )}
    </>
  );
}
