import type { Fanpage, PublicUser } from "./types";

export function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim();
}
export function matchesSearch(text: string, query: string) {
  const normalized = normalizeSearch(text);
  return normalizeSearch(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => normalized.includes(word));
}
export function groupFanpages<
  T extends Pick<Fanpage, "id" | "employeeIds" | "name">,
>(pages: T[], users: Pick<PublicUser, "id" | "name">[]) {
  const groups = new Map<string, { id: string; name: string; pages: T[] }>();
  for (const page of pages) {
    const ids = [...new Set(page.employeeIds)].sort();
    const id = ids.join("|") || "__unassigned__";
    const name =
      ids
        .map(
          (id) =>
            users.find((user) => user.id === id)?.name || "Nhân viên đã xóa",
        )
        .sort((a, b) => a.localeCompare(b, "vi"))
        .join(" · ") || "Chưa phân công";
    if (!groups.has(id)) groups.set(id, { id, name, pages: [] });
    groups.get(id)!.pages.push(page);
  }
  // A Page with several assignees belongs to one shared group, never duplicated.
  return [...groups.values()].sort((a, b) =>
    a.id === "__unassigned__"
      ? 1
      : b.id === "__unassigned__"
        ? -1
        : a.name.localeCompare(b.name, "vi"),
  );
}
export type StatusTone =
  "success" | "warning" | "danger" | "info" | "neutral" | "violet";
export function trackingTone(value: string): StatusTone {
  const text = normalizeSearch(value);
  if (/bo page|flop|dinh chi|sos|loi|xac minh/.test(text)) return "danger";
  if (/mat|can xem|can sua/.test(text)) return "warning";
  if (/de xuat|da duyet|hoat dong/.test(text)) return "success";
  if (/new|moi/.test(text)) return "info";
  return "neutral";
}
