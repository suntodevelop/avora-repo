export type AppearanceMode = "light" | "dark" | "system";
export type AppearancePreferences = { mode: AppearanceMode; accent: string };
export const appearanceKey = "avora-appearance";
export const defaultAppearance: AppearancePreferences = {
  mode: "light",
  accent: "#4263ed",
};
export const palette = [
  "#4263ed",
  "#8050d4",
  "#087f95",
  "#15845b",
  "#b86616",
  "#c53d68",
  "#526175",
  "#9e3ab9",
];
export function parseAppearance(raw: string | null): AppearancePreferences {
  try {
    const input = JSON.parse(raw || "{}");
    const legacy: Record<string, string> = {
      blue: "#4263ed",
      violet: "#8050d4",
      cyan: "#087f95",
    };
    return {
      mode: ["light", "dark", "system"].includes(input.mode)
        ? input.mode
        : "light",
      accent: /^#[0-9a-f]{6}$/i.test(input.accent)
        ? input.accent
        : legacy[input.accent] || defaultAppearance.accent,
    };
  } catch {
    return defaultAppearance;
  }
}
// Choose an accessible text color for user-selected backgrounds, including white/yellow.
export function contrastColor(hex: string) {
  const rgb = hex
    .match(/[a-f\d]{2}/gi)!
    .map((value) => parseInt(value, 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] > 0.179
    ? "#111827"
    : "#ffffff";
}
export const appearanceScript = `(${function () {
  try {
    const input = JSON.parse(localStorage.getItem("avora-appearance") || "{}");
    const legacy: Record<string, string> = {
      blue: "#4263ed",
      violet: "#8050d4",
      cyan: "#087f95",
    };
    const color = /^#[0-9a-f]{6}$/i.test(input.accent)
      ? input.accent
      : legacy[input.accent] || "#4263ed";
    const mode = ["light", "dark", "system"].includes(input.mode)
      ? input.mode
      : "light";
    const root = document.documentElement;
    root.dataset.theme =
      mode === "system"
        ? matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : mode;
    root.dataset.accent = "custom";
    root.style.setProperty("--brand-color", color);
    const source = color
      .match(/[a-f\d]{2}/gi)!
      .map((v: string) => parseInt(v, 16));
    const original = source
      .map((v: number) => v / 255)
      .map((v: number) =>
        v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
      )
      .reduce(
        (sum: number, v: number, i: number) =>
          sum + v * [0.2126, 0.7152, 0.0722][i],
        0,
      );
    root.style.setProperty(
      "--primary-foreground",
      original > 0.179 ? "#111827" : "#ffffff",
    );
    const dark = root.dataset.theme === "dark";
    const background = (dark ? [23, 31, 49] : [255, 255, 255])
      .map((v) => v / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    for (let step = 0; step <= 20; step++) {
      const rgb = source.map((v: number) =>
        Math.round(v + ((dark ? 255 - v : -v) * step) / 20),
      );
      const l = rgb
        .map((v: number) => v / 255)
        .map((v: number) =>
          v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
        )
        .reduce(
          (sum: number, v: number, i: number) =>
            sum + v * [0.2126, 0.7152, 0.0722][i],
          0,
        );
      if (
        (Math.max(l, background) + 0.05) / (Math.min(l, background) + 0.05) >=
        4.5
      ) {
        root.style.setProperty(
          "--readable-accent",
          "#" +
            rgb.map((v: number) => v.toString(16).padStart(2, "0")).join(""),
        );
        break;
      }
    }
  } catch {}
}.toString()})();`;
export function readableAccent(hex: string, dark: boolean) {
  const source = hex.match(/[a-f\d]{2}/gi)!.map((v) => parseInt(v, 16));
  const luminance = (rgb: number[]) =>
    rgb
      .map((v) => v / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const background = luminance(dark ? [23, 31, 49] : [255, 255, 255]);
  for (let step = 0; step <= 20; step++) {
    const rgb = source.map((v) =>
      Math.round(v + ((dark ? 255 - v : -v) * step) / 20),
    );
    const l = luminance(rgb);
    if (
      (Math.max(l, background) + 0.05) / (Math.min(l, background) + 0.05) >=
      4.5
    )
      return "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
  }
  return dark ? "#ffffff" : "#000000";
}
