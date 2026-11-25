import { redirect } from "next/navigation";
import { viewer } from "@/lib/auth";
import Workspace from "@/components/workspace";
import SummaryDashboard from "@/components/summary-dashboard";
export default async function Page() {
  const user = await viewer();
  if (!user) redirect("/login");
  if (user.role === "user") return <SummaryDashboard />;
  return <Workspace section="dashboard" />;
}
