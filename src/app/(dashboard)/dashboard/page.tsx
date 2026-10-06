import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (user?.role === "OWNER" || user?.role === "ADMIN") {
    redirect("/reports");
  } else {
    redirect("/pos");
  }
}
