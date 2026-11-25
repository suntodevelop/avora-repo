import { redirect } from "next/navigation";
import { viewer } from "@/lib/auth";
import Workspace from "@/components/workspace";
export const dynamic = "force-dynamic";
export default async function Page() {
  const user = await viewer();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");
  return <Workspace section="admin" />;
}
