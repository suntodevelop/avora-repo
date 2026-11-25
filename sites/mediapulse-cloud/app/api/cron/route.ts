import { timingSafeEqual } from "node:crypto";
import { readStore } from "@/lib/db";
import { syncPages } from "@/lib/sync";
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (
    !secret ||
    secret.startsWith("replace-") ||
    secret.length < 32 ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await readStore()).settings.cronEnabled)
    return Response.json({ skipped: true });
  const results = await syncPages();
  return Response.json(
    { results },
    { status: results.some((r) => !r.success) ? 502 : 200 },
  );
}
