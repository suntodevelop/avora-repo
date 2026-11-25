import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseAppearance, contrastColor } from "../src/lib/appearance";
test("SVG assets embed identical original logo bytes, without redrawing", () => {
  const original = readFileSync("public/brand/avora-logo.jpg");
  for (const path of [
    "public/brand/avora-logo.svg",
    "public/brand/avora-logo-transparent.svg",
    "public/brand/avora-mark.svg",
  ]) {
    const svg = readFileSync(path, "utf8");
    const encoded = svg.match(/data:image\/jpeg;base64,([^\"]+)/)?.[1];
    assert.ok(encoded);
    assert.deepEqual(Buffer.from(encoded, "base64"), original);
    assert.equal(svg.includes("<path"), false);
    assert.ok(svg.includes('filter="url(#remove-white)"'));
    assert.ok(
      svg.includes(
        path.includes("avora-logo")
          ? 'viewBox="40 160 1170 990"'
          : 'viewBox="175 165 990 675"',
      ),
    );
  }
});
test("Custom colors validate hex, migrate older preferences and choose readable button text", () => {
  assert.equal(parseAppearance('{"accent":"violet"}').accent, "#8050d4");
  assert.equal(
    parseAppearance('{"accent":"#f0c900","mode":"dark"}').accent,
    "#f0c900",
  );
  assert.equal(parseAppearance('{"accent":"bad"}').accent, "#4263ed");
  assert.equal(contrastColor("#ffffff"), "#111827");
  assert.equal(contrastColor("#000000"), "#ffffff");
});
import { appearanceScript, readableAccent } from "../src/lib/appearance";
test("Saved theme initializes before paint, including readable colors for white accents", () => {
  const styles = new Map<string, string>();
  const root = {
    dataset: {} as Record<string, string>,
    style: {
      setProperty: (name: string, value: string) => styles.set(name, value),
    },
  };
  new Function("localStorage", "document", "matchMedia", appearanceScript)(
    { getItem: () => '{"mode":"dark","accent":"#ffffff"}' },
    { documentElement: root },
    () => ({ matches: false }),
  );
  assert.equal(root.dataset.theme, "dark");
  assert.equal(styles.get("--brand-color"), "#ffffff");
  assert.equal(styles.get("--primary-foreground"), "#111827");
  assert.ok(styles.get("--readable-accent"));
  assert.notEqual(readableAccent("#ffffff", false), "#ffffff");
  assert.notEqual(readableAccent("#000000", true), "#000000");
});
