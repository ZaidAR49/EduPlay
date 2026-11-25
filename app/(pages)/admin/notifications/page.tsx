import { requirePermission } from "@/lib/auth/rbac";
import NotificationsClient from "./NotificationsClient";

export default async function NotificationsAdminPage() {
  const user = await requirePermission("notifications:read");

  return <NotificationsClient userRole={user.role as string} />;
}
