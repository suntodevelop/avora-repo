"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Check, Monitor, Moon, Palette, Sun, X, RotateCcw } from "lucide-react";
import {
  appearanceKey,
  defaultAppearance,
  parseAppearance,
  palette,
  contrastColor,
  readableAccent,
  type AppearanceMode,
} from "@/lib/appearance";
const Context = createContext({
  ...defaultAppearance,
  setMode: (_mode: AppearanceMode) => {},
  setAccent: (_accent: string) => {},
});
export function AppearanceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [preferences, setPreferences] = useState(defaultAppearance),
    [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      setPreferences(parseAppearance(localStorage.getItem(appearanceKey)));
    } catch {}
    setReady(true);
    const storage = (event: StorageEvent) => {
      if (event.key === appearanceKey)
        setPreferences(parseAppearance(event.newValue));
    };
    window.addEventListener("storage", storage);
    return () => window.removeEventListener("storage", storage);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const root = document.documentElement;
      root.dataset.theme =
        preferences.mode === "system"
          ? media.matches
            ? "dark"
            : "light"
          : preferences.mode;
      root.dataset.accent = "custom";
      root.style.setProperty("--brand-color", preferences.accent);
      root.style.setProperty(
        "--readable-accent",
        readableAccent(preferences.accent, root.dataset.theme === "dark"),
      );
      root.style.setProperty(
        "--primary-foreground",
        contrastColor(preferences.accent),
      );
    };
    apply();
    try {
      localStorage.setItem(appearanceKey, JSON.stringify(preferences));
    } catch {}
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [preferences, ready]);
  return (
    <Context.Provider
      value={{
        ...preferences,
        setMode: (mode) => setPreferences((current) => ({ ...current, mode })),
        setAccent: (accent) => {
          if (/^#[a-f\d]{6}$/i.test(accent))
            setPreferences((current) => ({ ...current, accent }));
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function AppearanceControl() {
  const appearance = useContext(Context),
    [open, setOpen] = useState(false),
    [hex, setHex] = useState(appearance.accent),
    container = useRef<HTMLDivElement>(null);
  useEffect(() => setHex(appearance.accent), [appearance.accent]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
        if (!container.current?.contains(event.target as Node)) setOpen(false);
      },
      escape = (event: KeyboardEvent) => {
        if (event.key === "Escape") setOpen(false);
      };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div className="appearance-control" ref={container}>
      <button
        className="icon-btn"
        aria-label="Tùy chỉnh giao diện"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Palette size={19} />
      </button>
      {open && (
        <section
          className="appearance-panel"
          role="dialog"
          aria-label="Tùy chỉnh giao diện"
        >
          <div className="appearance-heading">
            <strong>Giao diện của bạn</strong>
            <button
              className="icon-btn"
              aria-label="Đóng tùy chỉnh giao diện"
              onClick={() => setOpen(false)}
            >
              <X size={16} />
            </button>
          </div>
          <p>Một không gian mang màu sắc của bạn.</p>
          <span className="control-label">CHẾ ĐỘ HIỂN THỊ</span>
          <div className="theme-options">
            {(
              [
                { id: "light", label: "Sáng", Icon: Sun },
                { id: "dark", label: "Tối", Icon: Moon },
                { id: "system", label: "Hệ thống", Icon: Monitor },
              ] as const
            ).map(({ id, label, Icon }) => (
              <button
                key={id}
                aria-pressed={appearance.mode === id}
                onClick={() => appearance.setMode(id)}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </div>
          <span className="control-label">BẢNG MÀU</span>
          <div className="color-grid">
            {palette.map((color) => (
              <button
                key={color}
                aria-label={`Chọn màu ${color}`}
                aria-pressed={appearance.accent.toLowerCase() === color}
                onClick={() => appearance.setAccent(color)}
                style={{ background: color, color: contrastColor(color) }}
              >
                {appearance.accent.toLowerCase() === color && (
                  <Check size={17} />
                )}
              </button>
            ))}
          </div>
          <span className="control-label">MÀU TÙY CHỈNH</span>
          <div className="custom-color">
            <input
              type="color"
              aria-label="Chọn màu tùy chỉnh"
              value={appearance.accent}
              onChange={(event) => appearance.setAccent(event.target.value)}
            />
            <input
              aria-label="Mã màu HEX"
              value={hex}
              maxLength={7}
              spellCheck={false}
              onChange={(event) => {
                setHex(event.target.value);
                appearance.setAccent(event.target.value);
              }}
              onBlur={() => setHex(appearance.accent)}
            />
            <button
              className="icon-btn"
              aria-label="Khôi phục màu AVORA"
              onClick={() => appearance.setAccent(defaultAppearance.accent)}
            >
              <RotateCcw size={15} />
            </button>
          </div>
          <small>Tự lưu trên trình duyệt này.</small>
        </section>
      )}
    </div>
  );
}
