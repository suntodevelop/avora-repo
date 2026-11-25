import type { Metadata } from "next";
import "./globals.css";
import { requireChatGPTUser } from "./chatgpt-auth";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "MediaPulse · Hiệu suất nội dung",
  description:
    "Quản lý và theo dõi hiệu suất Facebook Fanpage của đội ngũ media",
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireChatGPTUser("/");
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
