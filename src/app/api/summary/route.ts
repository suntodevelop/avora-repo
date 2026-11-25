import { requireUser, HttpError } from "@/lib/auth";
import { readStore } from "@/lib/db";
import { companyStore } from "@/lib/permissions";
import { employeeReport } from "@/lib/report";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const actor = await requireUser();
    const input = new URL(request.url).searchParams;
    const report = employeeReport(
      companyStore(await readStore()),
      new URLSearchParams({
        from: input.get("from") || "",
        to: input.get("to") || "",
      }),
    );
    return Response.json(
      {
        viewer: { id: actor.id, name: actor.name, role: actor.role },
        rows: report.map((row) => ({
          employeeId: row.id,
          name: row.name,
          posts: row.posts,
          missingCounts: row.missingCounts,
          hasCounts: row.hasCounts,
        })),
        totalPosts: report.reduce((sum, row) => sum + row.posts, 0),
        missingCounts: report.reduce((sum, row) => sum + row.missingCounts, 0),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      { error: "Vui lòng đăng nhập" },
      { status: error instanceof HttpError ? error.status : 500 },
    );
  }
}
