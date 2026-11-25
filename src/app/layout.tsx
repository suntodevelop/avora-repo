import type { Metadata } from "next";
import "./globals.css";
import { AppearanceProvider } from "@/components/appearance";
import { appearanceScript } from "@/lib/appearance";
import { viewer } from "@/lib/auth";
export async function generateMetadata(): Promise<Metadata> {
  const user = await viewer();
  return {
    icons: {
      icon: [
        {
          url: "/brand/favicon-avora-symbol-v2.png",
          type: "image/png",
          sizes: "64x64",
        },
      ],
      shortcut: "/brand/favicon-avora-symbol-v2.ico",
    },
    title: user
      ? `AVORA MEDIA - ${user.role === "admin" ? "Admin" : user.role === "staff" ? "Staff" : "User"}`
      : "AVORA MEDIA",
    description:
      "Quản lý và theo dõi hiệu suất Facebook Fanpage của đội ngũ media",
  };
}
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: appearanceScript,
          }}
        />
      </head>
      <body>
        <AppearanceProvider>{children}</AppearanceProvider>
      </body>
    </html>
  );
}
