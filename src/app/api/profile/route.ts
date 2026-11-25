import { NextResponse } from "next/server";
import { checkOrigin, requireUser, HttpError } from "@/lib/auth";
import { mutateStore } from "@/lib/db";
import { z } from "zod";
export const dynamic = "force-dynamic";
function fail(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof z.ZodError
          ? "Thông tin hồ sơ không hợp lệ"
          : error instanceof HttpError
            ? error.message
            : "Không thể lưu hồ sơ",
    },
    {
      status:
        error instanceof HttpError
          ? error.status
          : error instanceof z.ZodError
            ? 400
            : 500,
    },
  );
}
export async function GET() {
  try {
    const { passwordHash, ...user } = await requireUser();
    return NextResponse.json(user, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return fail(error);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const actor = await requireUser();
    if (Number(request.headers.get("content-length") || 0) > 1500000)
      throw new HttpError(413, "Ảnh đại diện tối đa 1 MB");
    const form = await request.formData();
    const input = z
      .object({
        name: z.string().trim().min(1).max(120),
        phone: z
          .string()
          .trim()
          .max(30)
          .regex(/^[+\d\s().-]*$/),
        address: z.string().trim().max(500),
      })
      .parse({
        name: form.get("name"),
        phone: form.get("phone") || "",
        address: form.get("address") || "",
      });
    let avatarUrl: string | undefined;
    const file = form.get("avatar");
    if (file instanceof File && file.size) {
      if (file.size > 1048576)
        throw new HttpError(413, "Ảnh đại diện tối đa 1 MB");
      const bytes = Buffer.from(await file.arrayBuffer());
      let mime = "";
      if (
        bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      )
        mime = "image/png";
      else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
        mime = "image/jpeg";
      else if (
        bytes.toString("ascii", 0, 4) === "RIFF" &&
        bytes.toString("ascii", 8, 12) === "WEBP"
      )
        mime = "image/webp";
      if (!mime) throw new HttpError(400, "Chỉ nhận ảnh PNG, JPEG hoặc WebP");
      avatarUrl = `data:${mime};base64,${bytes.toString("base64")}`;
    }
    const user = await mutateStore((store) => {
      const current = store.users.find((user) => user.id === actor.id);
      if (!current) throw new HttpError(401, "Tài khoản không còn tồn tại");
      Object.assign(
        current,
        input,
        avatarUrl
          ? { avatarUrl }
          : form.get("removeAvatar") === "true"
            ? { avatarUrl: "" }
            : {},
      );
      const { passwordHash, ...safe } = current;
      return safe;
    });
    return NextResponse.json(user);
  } catch (error) {
    return fail(error);
  }
}
