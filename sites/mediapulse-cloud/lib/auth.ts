import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isMock, readStore } from "./db";
import type { Store, User } from "./types";
const state = globalThis as unknown as { demoSecret?: string };
function secret() {
  if (
    process.env.SESSION_SECRET &&
    process.env.SESSION_SECRET.length >= 32 &&
    !process.env.SESSION_SECRET.startsWith("replace-")
  )
    return process.env.SESSION_SECRET;
  if (!isMock()) throw new Error("Thiếu SESSION_SECRET (ít nhất 32 ký tự)");
  return (state.demoSecret ||= randomBytes(32).toString("hex"));
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function createSession(id: string) {
  const payload = Buffer.from(
    JSON.stringify({ id, exp: Date.now() + 8 * 3600000 }),
  ).toString("base64url");
  const signature = createHmac("sha256", secret())
    .update(payload)
    .digest("base64url");
  (await cookies()).set("media_session", `${payload}.${signature}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 28800,
    path: "/",
  });
}
export async function viewer(): Promise<User | null> {
  const value = (await cookies()).get("media_session")?.value;
  if (!value) return null;
  try {
    const [payload, signature] = value.split(".");
    const expected = createHmac("sha256", secret()).update(payload).digest();
    const actual = Buffer.from(signature, "base64url");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
      return null;
    const { id, exp } = JSON.parse(
      Buffer.from(payload, "base64url").toString(),
    );
    if (exp < Date.now()) return null;
    return (await readStore()).users.find((u) => u.id === id) || null;
  } catch {
    return null;
  }
}
export async function requireUser(admin = false) {
  const user = await viewer();
  if (!user) throw new HttpError(401, "Vui lòng đăng nhập");
  if (admin && user.role !== "admin")
    throw new HttpError(403, "Chỉ quản trị viên được thực hiện thao tác này");
  return user;
}
export function visibleStore(store: Store, user: User) {
  const pages = store.fanpages.filter(
    (p) =>
      user.role === "admin" ||
      store.settings.companyWide ||
      p.employeeIds.includes(user.id),
  );
  const ids = new Set(pages.map((p) => p.id));
  const posts = store.posts.filter((p) => ids.has(p.fanpageId));
  const userIds = new Set([
    ...pages.flatMap((p) => p.employeeIds),
    ...posts.map((p) => p.employeeId),
  ]);
  return {
    ...store,
    fanpages: pages,
    posts,
    users: store.users.filter(
      (u) => user.role === "admin" || userIds.has(u.id) || u.id === user.id,
    ),
  };
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host = request.headers.get("host") || new URL(request.url).host;
  try {
    const parsed = new URL(origin);
    if (parsed.host !== host || !["http:", "https:"].includes(parsed.protocol))
      throw new Error();
  } catch {
    throw new HttpError(403, "Origin không hợp lệ");
  }
}
