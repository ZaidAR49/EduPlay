import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/actions/utils";
import { isStaffRole } from "@/lib/auth/permissions";

export default async function LoginRedirectPage() {
  const user = await requireAuth();

  if (isStaffRole(user.role as string)) {
    redirect("/admin");
  }

  redirect("/dashboard");
}
