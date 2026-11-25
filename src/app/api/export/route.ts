import ExcelJS from "exceljs";
import { requireUser, visibleStore, HttpError } from "@/lib/auth";
import { readStore } from "@/lib/db";
import { employeeReport, filteredPosts, filteredChecks } from "@/lib/report";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    if (user.role === "user")
      throw new HttpError(403, "User chỉ được xem tổng số bài");
    const store = visibleStore(await readStore(), user);
    const params = new URL(request.url).searchParams;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "MediaPulse";
    const sheet = workbook.addWorksheet("Hiệu suất nhân viên");
    sheet.columns = [
      { header: "Nhân viên", key: "name", width: 25 },
      { header: "Fanpage phụ trách", key: "pages", width: 50 },
      { header: "Số bài đã ghi nhận", key: "posts", width: 22 },
      { header: "Dòng thiếu số bài", key: "missingCounts", width: 22 },
      { header: "Likes", key: "likes", width: 14 },
      { header: "Comments", key: "comments", width: 14 },
      { header: "Shares", key: "shares", width: 14 },
    ];
    employeeReport(store, params).forEach((row) =>
      sheet.addRow({
        ...row,
        posts: row.hasCounts ? row.posts : null,
        likes: row.likesKnown ? row.likes : null,
        comments: row.commentsKnown ? row.comments : null,
        shares: row.metricsKnown ? row.shares : null,
      }),
    );
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

      "Trạng thái",
      "Ghi chú",
    ]);
    filteredPosts(store, params).forEach((p) =>
      detail.addRow([
        p.postDate,
        new Intl.DateTimeFormat("vi-VN", {
          timeZone: "Asia/Ho_Chi_Minh",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hourCycle: "h23",
        }).format(new Date(p.createdTime)),
        store.fanpages.find((f) => f.id === p.fanpageId)?.name,
        store.users.find((u) => u.id === p.employeeId)?.name ||
          "Chưa phân công",
        p.message,
        p.permalinkUrl,
        p.likesAvailable !== false ? p.likes : null,
        p.commentsAvailable !== false ? p.comments : null,
        p.shares,

        p.status,
        p.note,
      ]),
    );
    detail.columns.forEach((c) => (c.width = 24));
    const checks = filteredChecks(store, params);
    if (checks.length) {
      const manual = workbook.addWorksheet("Check thủ công");
      manual.addRow([
        "Ngày",
        "Fanpage",
        "Link Page",
        "Nhân viên",
        "Số bài",
        "Số comment",
        "Giá trị số bài gốc",
        "Đã checked",
        "Ghi chú",
        "File nguồn",
        "Sheet",
        "Dòng",
      ]);
      checks.forEach((check) => {
        const page = store.fanpages.find((page) => page.id === check.fanpageId);
        manual.addRow([
          check.date,
          page?.name,
          page?.url,
          store.users.find((user) => user.id === check.employeeId)?.name ||
            "Chưa phân công",
          check.postCount,
          check.commentCount,
          check.postCountRaw,
          check.checked ? "Có" : "Chưa",
          check.note,
          check.sourceFile,
          check.sourceSheet,
          check.sourceRow,
        ]);
      });
      manual.columns.forEach((column) => (column.width = 24));
    }
    for (const s of workbook.worksheets) {
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
