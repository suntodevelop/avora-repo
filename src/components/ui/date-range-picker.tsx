"use client";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { shiftDay, todayVN } from "@/lib/time";
export default function DateRangePicker({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [target, setTarget] = useState<"from" | "to">("from"),
    [month, setMonth] = useState(from.slice(0, 7));
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
        if (!root.current?.contains(e.target as Node)) setOpen(false);
      },
      escape = (e: KeyboardEvent) => {
        if (e.key === "Escape") setOpen(false);
      };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const first = month + "-01",
    offset = (new Date(first + "T12:00:00Z").getUTCDay() + 6) % 7,
    days = new Date(
      Number(month.slice(0, 4)),
      Number(month.slice(5)),
      0,
    ).getDate();
  const move = (step: number) => {
    const d = new Date(first + "T12:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + step);
    setMonth(d.toISOString().slice(0, 7));
  };
  const pick = (date: string) => {
    if (target === "from") {
      onChange(date, date > to ? date : to);
      setTarget("to");
    } else {
      onChange(date < from ? date : from, date);
      setOpen(false);
    }
  };
  return (
    <div className="date-picker" ref={root}>
      <div className="date-range">
        <input
          type="date"
          aria-label="Từ ngày"
          value={from}
          max={to}
          onInput={(e) =>
            e.currentTarget.value && onChange(e.currentTarget.value, to)
          }
          onChange={(e) => e.target.value && onChange(e.target.value, to)}
        />
        <span>—</span>
        <input
          type="date"
          aria-label="Đến ngày"
          value={to}
          min={from}
          onInput={(e) =>
            e.currentTarget.value && onChange(from, e.currentTarget.value)
          }
          onChange={(e) => e.target.value && onChange(from, e.target.value)}
        />
        <button
          className="calendar-trigger"
          aria-label="Mở lịch chọn ngày"
          aria-expanded={open}
          onClick={() => {
            setTarget("from");
            setMonth((from || todayVN()).slice(0, 7));
            setOpen(!open);
          }}
        >
          <CalendarDays size={17} />
        </button>
      </div>
      {open && (
        <section
          className="calendar-popover"
          role="dialog"
          aria-label="Chọn khoảng ngày"
        >
          <div className="calendar-target">
            <button
              aria-pressed={target === "from"}
              onClick={() => setTarget("from")}
            >
              Từ ngày
            </button>
            <button
              aria-pressed={target === "to"}
              onClick={() => setTarget("to")}
            >
              Đến ngày
            </button>
            <button
              className="icon-btn"
              aria-label="Đóng lịch"
              onClick={() => setOpen(false)}
            >
              <X size={16} />
            </button>
          </div>
          <div className="calendar-month">
            <button
              className="icon-btn"
              aria-label="Tháng trước"
              onClick={() => move(-1)}
            >
              <ChevronLeft size={17} />
            </button>
            <strong>
              Tháng {Number(month.slice(5))}, {month.slice(0, 4)}
            </strong>
            <button
              className="icon-btn"
              aria-label="Tháng sau"
              onClick={() => move(1)}
            >
              <ChevronRight size={17} />
            </button>
          </div>
          <div className="calendar-grid">
            {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => (
              <small key={day}>{day}</small>
            ))}
            {Array.from({ length: offset }, (_, i) => (
              <span key={"blank" + i} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const date = shiftDay(first, i);
              return (
                <button
                  key={date}
                  className={`${date === from || date === to ? "selected" : ""} ${date > from && date < to ? "in-range" : ""}`}
                  aria-label={date}
                  aria-pressed={date === from || date === to}
                  onClick={() => pick(date)}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <p>Chọn ngày bắt đầu, sau đó chọn ngày kết thúc.</p>
        </section>
      )}
    </div>
  );
}
