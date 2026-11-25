import { cache } from "react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import {
  type AdminPermission,
  hasPermission,
  isStaffRole,
} from "./permissions";
import { touchUserLastActive } from "@/lib/services/activity.service";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Retrieves the freshest user record from the database (memoized per request).
 * Fails closed to role "user" if DB lookup fails or record is missing.
 */
export const getCurrentUser = cache(async () => {
  const session = await auth();
  if (!session?.user) return null;

  try {
    let dbUser = null;
    if (session.user.id && UUID_REGEX.test(session.user.id)) {
      dbUser = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
      });
    }
    if (!dbUser && session.user.email) {
      dbUser = await db.query.users.findFirst({
        where: eq(users.email, session.user.email),
      });
    }

    if (!dbUser || dbUser.deletedAt) {
      return {
        id: session.user.id || "",
        name: session.user.name || "User",
        email: session.user.email || "",
        role: "user",
        isLocked: Boolean((session.user as any).isLocked),
        image: session.user.image ?? null,
      } as typeof users.$inferSelect;
    }

    // Always pull avatar from the active OAuth session, never from DB
    return {
      ...dbUser,
      image: session.user.image ?? null,
    };
  } catch (error) {
    console.error("[getCurrentUser] DB lookup failed, failing closed to session role:", error);
    const sessionRole = (session.user as any).role;
    return {
      id: session.user.id || "",
      name: session.user.name || "User",
      email: session.user.email || "",
      role: isStaffRole(sessionRole) ? sessionRole : "user",
      isLocked: Boolean((session.user as any).isLocked),
      image: session.user.image ?? null,
    } as typeof users.$inferSelect;
  }
});

/**
 * Ensures the user has staff access to the admin panel (admin, editor, or viewer).
 * Also updates lastActiveAt (throttled).
 */
export async function requireDashboardAccess() {
  const user = await getCurrentUser();
  if (!user) redirect("/api/auth/signin");
  if (user.isLocked) redirect("/blocked");
  if (!isStaffRole(user.role)) {
    redirect("/unauthorized");
  }
  await touchUserLastActive(user.id, user.lastActiveAt);
  return user;
}

/**
 * Page/query guard: verifies staff access and specific capability, redirecting
 * unauthorized staff to /unauthorized.
 */
export async function requirePermission(permission: AdminPermission) {
  const user = await requireDashboardAccess();
  if (!hasPermission(user.role, permission)) {
    redirect("/unauthorized");
  }
  return user;
}

/**
 * Server Action mutation guard: redirects unauthenticated/blocked users and
 * throws an explicit Error when the staff member lacks the required permission.
 */
export async function requireActionPermission(permission: AdminPermission) {
  const user = await requireDashboardAccess();
  if (!hasPermission(user.role, permission)) {
    throw new Error(`Forbidden: missing permission "${permission}"`);
  }
  return user;
}

/**
 * Verifies session + DB lock/delete state for API routes and non-redirecting Server Actions.
 */
export async function verifyActiveSessionUser(): Promise<
  | { ok: true; user: typeof users.$inferSelect }
  | { ok: false; status: 401 | 403; error: string }
> {
  const session = await auth();
  if (!session?.user?.id && !session?.user?.email) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const dbUser = await getCurrentUser();
  if (!dbUser || !dbUser.id || dbUser.deletedAt) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  if (dbUser.isLocked) {
    return { ok: false, status: 403, error: "Account is blocked" };
  }

  await touchUserLastActive(dbUser.id, dbUser.lastActiveAt);
  return { ok: true, user: dbUser };
}
