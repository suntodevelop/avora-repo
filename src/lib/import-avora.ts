import { hashPassword } from "./crypto";
import { parsePageInput } from "./facebook";
import type { Store } from "./types";

type Cell = { cell: string; value: string; url?: string };
type Sheet = {
  name: string;
  rows: { row: number; cells: Cell[] }[];
  merged: string[];
};
export type SourceWorkbook = { source: string; sheets: Sheet[] };
const clean = (value: string) => value.replace(/\s+/g, " ").trim();
const slug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "");
const count = (value: string) =>
  /^\d+(?:\.0+)?$/.test(value.trim()) ? Number(value) : null;
const excelDate = (value: string) =>
  /^\d+$/.test(value)
    ? new Date(Date.UTC(1899, 11, 30) + Number(value) * 86400000)
        .toISOString()
        .slice(0, 10)
    : null;

export function importAvora(store: Store, workbook: SourceWorkbook) {
  const sheet = workbook.sheets.find((sheet) => sheet.name === "CHECK LIST");
  if (!sheet) throw new Error("Không tìm thấy sheet CHECK LIST");
  const cellMap = new Map(
    sheet.rows.flatMap((row) => row.cells).map((cell) => [cell.cell, cell]),
  );
  function cell(column: string, row: number, merged = false): Cell | undefined {
    const direct = cellMap.get(`${column}${row}`);
    if (direct || !merged) return direct;
    for (const range of sheet!.merged) {
      const match = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
      if (
        match &&
        match[1] === column &&
        match[3] === column &&
        row >= +match[2] &&
        row <= +match[4]
      )
        return cellMap.get(`${column}${match[2]}`);
    }
  }
  store.manualChecks ||= [];
  const issues: { row: number; page: string; issue: string }[] = [];
  const employees = new Set<string>();
  let pages = 0,
    validLinks = 0,
    missingLinks = 0,
    invalidLinks = 0,
    totalPosts = 0,
    unknownCounts = 0;
  // Existing seeded employees retain access to their demo Pages as Staff.
  for (const user of store.users)
    if (user.role === "user" && /^nv\d@media\.local$/.test(user.email))
      user.role = "staff";
  for (const row of sheet.rows.filter((row) => row.row >= 5)) {
    const name = clean(cell("B", row.row)?.value || "");
    const employeeName = clean(cell("A", row.row, true)?.value || "");
    if (!name || !employeeName) {
      if (cell("C", row.row)?.url || cell("C", row.row)?.value)
        issues.push({
          row: row.row,
          page: name,
          issue:
            "Dòng chỉ có link, không có tên Page hoặc nhân viên trong vùng gộp. Không tự gán.",
        });
      continue;
    }
    const staffId = `avora:staff:${slug(employeeName)}`;
    employees.add(staffId);
    if (!store.users.some((user) => user.id === staffId))
      store.users.push({
        id: staffId,
        name: employeeName,
        email: `${slug(employeeName)}@avora.local`,
        role: "staff",
        passwordHash: hashPassword("Avora@12345"),
        facebookName: "",
        facebookUrl: "",
      });
    const url = clean(
      cell("C", row.row)?.url || cell("C", row.row)?.value || "",
    );
    let pageId: string | null = null;
    if (!url) {
      missingLinks++;
      issues.push({ row: row.row, page: name, issue: "Chưa có link Fanpage" });
    } else {
      try {
        pageId = parsePageInput(url);
        validLinks++;
      } catch {
        invalidLinks++;
        issues.push({
          row: row.row,
          page: name,
          issue: "Link không phải Fanpage (ví dụ link settings). Cần sửa.",
        });
      }
    }
    const id = `avora:page:${row.row}`;
    const duplicate =
      pageId &&
      store.fanpages.find((page) => page.pageId === pageId && page.id !== id);
    if (duplicate) {
      issues.push({
        row: row.row,
        page: name,
        issue:
          "Page ID trùng với Page đã có; không tạo trùng hoặc tự gán thêm nhân viên.",
      });
      continue;
    }
    const note = clean(cell("H", row.row)?.value || "");
    if (!store.fanpages.some((page) => page.id === id))
      store.fanpages.push({
        id,
        name,
        pageId,
        url,
        tokenEncrypted: "",
        source: "manual",
        lastSync: null,
        employeeIds: [staffId],
        managerFacebookName: "",
        managerFacebookUrl: "",
        trackingStatus: clean(cell("D", row.row)?.value || ""),
        topic: clean(cell("E", row.row)?.value || ""),
        note,
      });
    const date = excelDate(
      cell("I", row.row, true)?.value || cellMap.get("K2")?.value || "",
    );
    if (!date) throw new Error(`Không xác định được ngày của dòng ${row.row}`);
    const postCountRaw = clean(cell("F", row.row)?.value || "");
    const commentCountRaw = clean(cell("G", row.row)?.value || "");
    const postCount = count(postCountRaw);
    totalPosts += postCount ?? 0;
    if (postCount === null) {
      unknownCounts++;
      if (postCountRaw)
        issues.push({
          row: row.row,
          page: name,
          issue: `Số bài là "${postCountRaw}", không coi là 0`,
        });
    }
    const checkId = `avora:check:${date}:${row.row}`;
    if (!store.manualChecks.some((check) => check.id === checkId))
      store.manualChecks.push({
        id: checkId,
        fanpageId: id,
        employeeId: staffId,
        date,
        postCount,
        commentCount: count(commentCountRaw),
        postCountRaw,
        commentCountRaw,
        checked: cell("J", row.row, true)?.value === "1",
        note,
        sourceFile: workbook.source,
        sourceSheet: sheet.name,
        sourceRow: row.row,
      });
    pages++;
  }
  if (!store.users.some((user) => user.email === "viewer@avora.local"))
    store.users.push({
      id: "avora:viewer",
      name: "Người xem tổng số bài",
      email: "viewer@avora.local",
      role: "user",
      passwordHash: hashPassword("Demo@12345"),
    });
  return {
    employees: employees.size,
    pages,
    validLinks,
    missingLinks,
    invalidLinks,
    totalPosts,
    unknownCounts,
    issues,
  };
}
