import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { checkOrigin, createSession, HttpError } from "@/lib/auth";
import { readStore } from "@/lib/db";
import { checkPassword } from "@/lib/crypto";
const state = globalThis as unknown as {
  attempts?: Map<string, { count: number; until: number }>;
};
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { email, password } = (await request.json()) as {
      email?: unknown;
      password?: unknown;
    };
    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      password.length > 256
    )
      throw new HttpError(400, "Thông tin không hợp lệ");
    const key = email.toLowerCase().trim();
    const attempts = (state.attempts ||= new Map());
    const previous = attempts.get(key);
    const attempt =
      previous && previous.until > Date.now()
        ? previous
        : { count: 0, until: Date.now() + 15 * 60000 };
    if (attempt.count >= 10) throw new HttpError(429, "Thử lại sau 15 phút");
    const user = (await readStore()).users.find(
      (u) => u.email.toLowerCase() === key,
    );
    if (!user || !checkPassword(password, user.passwordHash)) {
      attempt.count++;
      attempts.set(key, attempt);
      throw new HttpError(401, "Email hoặc mật khẩu không đúng");
    }
    attempts.delete(key);
    await createSession(user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof HttpError ? e.message : "Không thể đăng nhập" },
      { status: e instanceof HttpError ? e.status : 500 },
    );
  }
}
export async function DELETE(request: Request) {
  checkOrigin(request);
  (await cookies()).delete("media_session");
  return NextResponse.json({ ok: true });
}
