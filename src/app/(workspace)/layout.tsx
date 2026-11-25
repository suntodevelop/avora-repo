import { redirect } from "next/navigation";
import { viewer } from "@/lib/auth";
import AppShell from "@/components/app-shell";
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await viewer();
  if (!user) redirect("/login");
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return <AppShell viewer={safeUser}>{children}</AppShell>;
}
