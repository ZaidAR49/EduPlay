import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { activityLogs, users } from "@/lib/db/schema";

export type UserActivityStatus = "blocked" | "active" | "idle" | "inactive" | "never";

const ACTIVE_WINDOW_DAYS = 7;
const IDLE_WINDOW_DAYS = 30;
export const LAST_ACTIVE_THROTTLE_MS = 5 * 60 * 1000;

/**
 * Computes separate access state vs engagement tier so "not blocked" is never
 * mislabeled as "Active".
 */
export function deriveUserStatus(params: {
  isLocked: boolean;
  lastActiveAt: Date | null;
  lastLoginAt: Date | null;
  now?: Date;
}): {
  accountStatus: "blocked" | "allowed";
  activityStatus: UserActivityStatus;
  effectiveLastActiveAt: Date | null;
} {
  const { isLocked, lastActiveAt, lastLoginAt, now = new Date() } = params;
  const effectiveLastActiveAt =
    lastActiveAt && lastLoginAt
      ? (lastActiveAt > lastLoginAt ? lastActiveAt : lastLoginAt)
      : (lastActiveAt ?? lastLoginAt ?? null);

  const accountStatus = isLocked ? "blocked" : "allowed";
  if (isLocked) {
    return { accountStatus, activityStatus: "blocked", effectiveLastActiveAt };
  }

  if (!effectiveLastActiveAt) {
    return { accountStatus, activityStatus: "never", effectiveLastActiveAt: null };
  }

  const diffDays = (now.getTime() - effectiveLastActiveAt.getTime()) / 86_400_000;
  if (diffDays <= ACTIVE_WINDOW_DAYS) {
    return { accountStatus, activityStatus: "active", effectiveLastActiveAt };
  }
  if (diffDays <= IDLE_WINDOW_DAYS) {
    return { accountStatus, activityStatus: "idle", effectiveLastActiveAt };
  }
  return { accountStatus, activityStatus: "inactive", effectiveLastActiveAt };
}

/**
 * Updates users.last_active_at at most once per throttle window (unless forced).
 * Fails silently so DB outages or pre-migration runs do not break app flows.
 */
export async function touchUserLastActive(
  userId: string,
  previousLastActiveAt?: Date | null,
  force = false
): Promise<void> {
  if (!userId) return;
  if (
    !force &&
    previousLastActiveAt &&
    Date.now() - previousLastActiveAt.getTime() < LAST_ACTIVE_THROTTLE_MS
  ) {
    return;
  }

  try {
    await db
      .update(users)
      .set({ lastActiveAt: new Date() })
      .where(eq(users.id, userId));
  } catch (err) {
    console.warn("[activity] Failed to update lastActiveAt:", (err as Error).message);
  }
}

/**
 * Records a user action or admin audit event in activity_logs.
 * Fails silently so audit logging never interrupts primary user/admin operations.
 */
export async function logActivity(params: {
  actorId?: string | null;
  targetUserId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(activityLogs).values({
      actorId: params.actorId ?? null,
      targetUserId: params.targetUserId ?? null,
      action: params.action,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
      metadata: params.metadata ?? {},
    });
  } catch (err) {
    console.warn("[activity] Failed to insert activity_log:", (err as Error).message);
  }
}
