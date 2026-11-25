"use client";
import { useState } from "react";
type Item = { id: string; label: string; value: number };
const colors = [
  "var(--accent)",
  "#9271e9",
  "#22a8c9",
  "#e6a34b",
  "#db709f",
  "#9ba6bc",
];
export default function DonutChart({
  items,
  title = "Phân bổ bài đăng",
  subtitle = "Tỷ trọng số bài đã ghi nhận theo nhân viên.",
}: {
  items: Item[];
  title?: string;
  subtitle?: string;
}) {
  const [highlight, setHighlight] = useState<string | null>(null);
  const positive = [...items]
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
  const chart =
    positive.length > 6
      ? [
          ...positive.slice(0, 5),
          {
            id: "__others__",
            label: `${positive.length - 5} nhân viên khác`,
            value: positive.slice(5).reduce((sum, item) => sum + item.value, 0),
          },
        ]
      : positive;
  const total = chart.reduce((sum, item) => sum + item.value, 0);
  let offset = 0;
  const circumference = 2 * Math.PI * 72;
  return (
    <section className="panel donut-panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <span className="count-badge">{positive.length} người có số bài</span>
      </div>
      <div className="donut-content">
        <div className="donut-visual">
          <svg
            viewBox="0 0 200 200"
            role="img"
            aria-label={`Biểu đồ tròn ${title}: tổng ${total.toLocaleString("vi-VN")} bài`}
          >
            <circle
              cx="100"
              cy="100"
              r="72"
              fill="none"
              stroke="var(--chart-track)"
              strokeWidth="22"
            />
            {chart.map((item, index) => {
              const length = (item.value / total) * circumference;
              const start = offset;
              offset += length;
              return (
                <circle
                  key={item.id}
                  cx="100"
                  cy="100"
                  r="72"
                  fill="none"
                  stroke={colors[index % colors.length]}
                  strokeWidth="22"
                  strokeDasharray={`${Math.max(0, length - 3)} ${circumference}`}
                  strokeDashoffset={-start}
                  transform="rotate(-90 100 100)"
                  opacity={!highlight || highlight === item.id ? 1 : 0.24}
                >
                  <title>
                    {item.label}: {item.value} bài (
                    {((item.value / total) * 100).toFixed(1)}%)
                  </title>
                </circle>
              );
            })}
          </svg>
          <div className="donut-center">
            <strong>{total.toLocaleString("vi-VN")}</strong>
            <span>bài đã ghi nhận</span>
          </div>
        </div>
        <div className="chart-legend">
          {chart.map((item, index) => (
            <button
              key={item.id}
              onMouseEnter={() => setHighlight(item.id)}
              onMouseLeave={() => setHighlight(null)}
              onFocus={() => setHighlight(item.id)}
              onBlur={() => setHighlight(null)}
              onClick={() =>
                setHighlight(highlight === item.id ? null : item.id)
              }
              aria-pressed={highlight === item.id}
            >
              <i style={{ background: colors[index % colors.length] }} />
              <span>{item.label}</span>
              <strong>{item.value.toLocaleString("vi-VN")}</strong>
              <small>{((item.value / total) * 100).toFixed(1)}%</small>
            </button>
          ))}
          {!total && (
            <p className="chart-empty">Chưa có số bài trong khoảng đã chọn.</p>
          )}
        </div>
      </div>
      <div className="chart-footnote">
        Không đưa số liệu trống hoặc SOS vào tỷ trọng.
      </div>
    </section>
  );
}
