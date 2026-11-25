import { redirect } from "next/navigation";
import { viewer } from "@/lib/auth";
import Workspace from "@/components/workspace";
export default async function Page() {
  const user = await viewer();
  if (!user) redirect("/login");
  if (user.role === "user") redirect("/");
  return <Workspace section="posts" />;
}
