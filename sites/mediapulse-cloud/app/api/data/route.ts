import { NextResponse } from "next/server";
import { checkOrigin, HttpError, requireUser, visibleStore } from "@/lib/auth";
import { isMock, mutateStore, readStore } from "@/lib/db";
import { z } from "zod";
// Worker runtimes prohibit runtime code generation. Use Zod's interpreter.
z.config({ jitless: true });
import { randomUUID } from "node:crypto";
import { encryptToken, hashPassword } from "@/lib/crypto";
import { parsePageInput, resolvePage } from "@/lib/facebook";
import { syncPages } from "@/lib/sync";
import { mockPosts } from "@/lib/mock";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const viewer = await requireUser();
    const data = visibleStore(await readStore(), viewer);
    const { passwordHash: _p, ...safeViewer } = viewer;
    return NextResponse.json(
      {
        ...data,
        viewer: safeViewer,
        users: data.users.map(({ passwordHash: _h, ...user }) => user),
        fanpages: data.fanpages.map(({ tokenEncrypted: _t, ...page }) => page),
        mode: isMock() ? "mock" : "database",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const actor = await requireUser(true);
    const body = z.record(z.string(), z.unknown()).parse(await request.json());
    if (body.action === "sync") {
      const results = await syncPages(z.string().optional().parse(body.id));
      return NextResponse.json({ results });
    }
    if (body.action === "savePage") {
      const input = z
        .object({
          id: z.string().optional(),
          name: z.string().min(1).max(120),
          url: z.string().min(1).max(500),
          token: z.string().max(4096).default(""),
          source: z.enum(["mock", "facebook"]),
          employeeIds: z.array(z.string()).min(1),
        })
        .parse(body);
      const parsedId = parsePageInput(input.url);
      let resolved = { id: parsedId, name: input.name };
      const old = (await readStore()).fanpages.find((p) => p.id === input.id);
      if (input.source === "facebook") {
        if (!input.token && (!old?.tokenEncrypted || old.pageId !== parsedId))
          throw new HttpError(400, "Nhập token để kiểm tra kết nối");
        if (input.token) resolved = await resolvePage(input.url, input.token);
      }
      const savedId = await mutateStore((store) => {
        if (
          input.employeeIds.some((id) => !store.users.some((u) => u.id === id))
        )
          throw new HttpError(400, "Nhân viên không tồn tại");
        if (
          store.fanpages.some(
            (p) => p.pageId === resolved.id && p.id !== input.id,
          )
        )
          throw new HttpError(409, "Fanpage đã tồn tại");
        const existing = store.fanpages.find((p) => p.id === input.id);
        if (input.id && !existing)
          throw new HttpError(404, "Fanpage không tồn tại");
        if (
          existing &&
          (existing.pageId !== resolved.id || existing.source !== input.source)
        )
          throw new HttpError(
            400,
            "Không đổi định danh/nguồn của Page đã lưu; hãy thêm Page mới",
          );
        const page = {
          id: input.id || randomUUID(),
          name: input.name,
          url: `https://www.facebook.com/${resolved.id}`,
          pageId: resolved.id,
          employeeIds: [...new Set(input.employeeIds)],
          source: input.source,
          tokenEncrypted:
            input.source === "facebook"
              ? input.token
                ? encryptToken(input.token)
                : existing?.tokenEncrypted || ""
              : "",
          lastSync: existing?.lastSync || null,
        };
        if (existing) Object.assign(existing, page);
        else {
          store.fanpages.push(page);
          if (page.source === "mock") store.posts.push(...mockPosts(page));
        }
        return page.id;
      });
      return NextResponse.json({ ok: true, results: await syncPages(savedId) });
    }
    await mutateStore((store) => {
      switch (body.action) {
        case "saveUser": {
          const input = z
            .object({
              id: z.string().optional(),
              name: z.string().trim().min(1).max(120),
              email: z.email(),
              role: z.enum(["admin", "user"]),
              password: z.string().max(256).optional(),
              facebookUserId: z.string().regex(/^\d*$/).optional(),
            })
            .parse(body);
          if (
            store.users.some(
              (u) =>
                u.email.toLowerCase() === input.email.toLowerCase() &&
                u.id !== input.id,
            )
          )
            throw new HttpError(409, "Email đã tồn tại");
          if (
            input.facebookUserId &&
            store.users.some(
              (u) =>
                u.facebookUserId === input.facebookUserId && u.id !== input.id,
            )
          )
            throw new HttpError(409, "Facebook User ID đã tồn tại");
          const existing = store.users.find((u) => u.id === input.id);
          if (input.id && !existing)
            throw new HttpError(404, "Nhân viên không tồn tại");
          if (existing?.id === actor.id && input.role !== "admin")
            throw new HttpError(400, "Không thể tự bỏ quyền admin");
          if (
            (!existing || input.password) &&
            (input.password || "").length < 10
          )
            throw new HttpError(400, "Mật khẩu cần ít nhất 10 ký tự");
          const newId = input.id || randomUUID();
          const passwordHash = input.password
            ? hashPassword(input.password)
            : existing!.passwordHash;
          const data = {
            id: newId,
            name: input.name,
            email: input.email.toLowerCase(),
            role: input.role,
            facebookUserId: input.facebookUserId || null,
            passwordHash,
          };
          if (existing) Object.assign(existing, data);
          else store.users.push(data);
          break;
        }
        case "deleteUser": {
          const id = z.string().parse(body.id);
          if (id === actor.id)
            throw new HttpError(400, "Không thể xóa tài khoản đang đăng nhập");
          store.users = store.users.filter((u) => u.id !== id);
          store.fanpages.forEach(
            (p) => (p.employeeIds = p.employeeIds.filter((u) => u !== id)),
          );
          store.posts.forEach((p) => {
            if (p.employeeId === id) {
              p.employeeId = null;
              p.attribution = "unassigned";
            }
          });
          break;
        }
        case "deletePage": {
          const id = z.string().parse(body.id);
          store.fanpages = store.fanpages.filter((p) => p.id !== id);
          store.posts = store.posts.filter((p) => p.fanpageId !== id);
          break;
        }
        case "review": {
          const input = z
            .object({
              id: z.string(),
              status: z.enum(["pending", "approved", "flagged"]),
              note: z.string().max(2000),
              employeeId: z.string().nullable().optional(),
            })
            .parse(body);
          const post = store.posts.find((p) => p.id === input.id);
          if (!post) throw new HttpError(404, "Không tìm thấy bài viết");
          if (
            input.employeeId &&
            !store.fanpages
              .find((p) => p.id === post.fanpageId)
              ?.employeeIds.includes(input.employeeId)
          )
            throw new HttpError(400, "Nhân viên chưa được gán Page");
          Object.assign(
            post,
            { status: input.status, note: input.note },
            input.employeeId !== undefined
              ? { employeeId: input.employeeId, attribution: "manual" }
              : {},
          );
          break;
        }
        case "settings":
          store.settings = z
            .object({ companyWide: z.boolean(), cronEnabled: z.boolean() })
            .parse(body.settings);
          break;
        default:
          throw new HttpError(400, "Thao tác không hợp lệ");
      }
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
function failure(error: unknown) {
  if (error instanceof HttpError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  if (error instanceof z.ZodError)
    return NextResponse.json(
      {
        error: "Dữ liệu nhập không hợp lệ",
        details: error.issues.map((i) => i.path.join(".")),
      },
      { status: 400 },
    );
  return NextResponse.json(
    {
      error:
        error instanceof Error &&
        !/prisma|database|connect|constraint/i.test(error.message)
          ? error.message
          : "Không thể xử lý. Kiểm tra cấu hình server/database.",
    },
    { status: 500 },
  );
}
