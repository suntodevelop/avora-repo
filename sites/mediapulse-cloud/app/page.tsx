import { redirect } from "next/navigation";
import { viewer } from "@/lib/auth";
import Workspace from "@/components/workspace";
export const dynamic = "force-dynamic";
export default async function Page() {
  if (!(await viewer())) redirect("/login");
  return <Workspace section="dashboard" />;
}
