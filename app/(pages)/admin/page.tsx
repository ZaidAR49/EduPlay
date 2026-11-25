import { redirect } from "next/navigation"
import { requireDashboardAccess } from "@/lib/auth/rbac"

export default async function AdminPage() {
  const user = await requireDashboardAccess()

  if (user.role === "viewer") {
    redirect("/admin/analytics")
  }

  redirect("/admin/accounts")
}
