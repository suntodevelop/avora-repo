import ExcelJS from "exceljs";
import { requireUser, visibleStore, HttpError } from "@/lib/auth";
import { readStore } from "@/lib/db";
import { employeeReport, filteredPosts } from "@/lib/report";
import { engagement } from "@/lib/time";
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const store = visibleStore(await readStore(), user);
    const params = new URL(request.url).searchParams;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "MediaPulse";
    const sheet = workbook.addWorksheet("Hiệu suất nhân viên");
    sheet.columns = [
      { header: "Nhân viên", key: "name", width: 25 },
      { header: "Fanpage phụ trách", key: "pages", width: 50 },
      { header: "Số bài", key: "posts", width: 12 },
      { header: "Likes", key: "likes", width: 14 },
      { header: "Comments", key: "comments", width: 14 },
      { header: "Shares", key: "shares", width: 14 },
      { header: "Tổng tương tác", key: "total", width: 20 },
    ];
    employeeReport(store, params).forEach((row) => sheet.addRow(row));
    const detail = workbook.addWorksheet("Bài viết");
    detail.addRow([
      "Ngày UTC+7",
      "Giờ",
      "Fanpage",
      "Nhân viên",
      "Nội dung",
      "Link",
      "Likes",
      "Comments",
      "Shares",
      "Tương tác",
      "Trạng thái",
      "Ghi chú",
    ]);
    filteredPosts(store, params).forEach((p) =>
      detail.addRow([
        p.postDate,
        p.postHour,
        store.fanpages.find((f) => f.id === p.fanpageId)?.name,
        store.users.find((u) => u.id === p.employeeId)?.name ||
          "Chưa phân công",
        p.message,
        p.permalinkUrl,
        p.likes,
        p.comments,
        p.shares,
        engagement(p),
        p.status,
        p.note,
      ]),
    );
    detail.columns.forEach((c) => (c.width = 24));
    for (const s of [sheet, detail]) {
      s.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      s.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF087F64" },
      };
      s.views = [{ state: "frozen", ySplit: 1 }];
      s.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: s.columnCount },
      };
    }
    const bytes = await workbook.xlsx.writeBuffer();
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="media-pulse-report.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return Response.json(
      { error: "Không thể xuất báo cáo" },
      { status: e instanceof HttpError ? e.status : 500 },
    );
  }
}
