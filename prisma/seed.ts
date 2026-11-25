import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/crypto";
const db = new PrismaClient();
async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password || password.length < 10)
    throw new Error(
      "Thiết lập SEED_ADMIN_EMAIL và SEED_ADMIN_PASSWORD (ít nhất 10 ký tự)",
    );
  await db.user.upsert({
    where: { email },
    update: {},
    create: {
      id: "admin",
      name: "Quản trị viên",
      email,
      role: "admin",
      passwordHash: hashPassword(password),
    },
  });
  await db.setting.upsert({
    where: { id: "main" },
    update: {},
    create: { id: "main" },
  });
  console.log("Đã tạo admin (không ghi đè mật khẩu tài khoản hiện có).");
}
main().finally(() => db.$disconnect());
