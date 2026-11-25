import { requirePermission } from "@/lib/auth/rbac"
import { SettingsClient } from "@/components/admin/settings/SettingsClient"
import { getAdminsAction } from "@/lib/actions/admin.actions"

export default async function AdminSettingsPage() {
  const user = await requirePermission("staff:read")
  const initialAdmins = await getAdminsAction()

  return (
    <SettingsClient
      userRole={user.role as string}
      currentUserId={user.id}
      initialAdmins={initialAdmins as any[]}
    />
  )
}
