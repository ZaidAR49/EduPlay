import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isStaffRole } from "@/lib/auth/permissions";
import { NOINDEX_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Teacher Sign In",
  robots: NOINDEX_ROBOTS,
};

export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (session?.user?.id || session?.user?.email) {
    const isUuid =
      typeof session.user.id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session.user.id);

    const dbUser = await db.query.users.findFirst({
      where: isUuid ? eq(users.id, session.user.id) : eq(users.email, session.user.email!),
      columns: { isLocked: true, role: true }
    });

    if (dbUser?.isLocked) {
      const { ForceSignout } = await import("@/components/auth/ForceSignout");
      return <ForceSignout />;
    }

    const role = dbUser?.role ?? (session.user as any).role;
    if (isStaffRole(role)) {
      redirect("/admin");
    }
    redirect("/dashboard");
  }

  return <>{children}</>;
}
