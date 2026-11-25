"use server";

import { eq, inArray, sql, and, or, ilike, desc, asc, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  users,
  organizations,
  games,
  classroomPlays,
  usageEvents,
  activityLogs,
} from "@/lib/db/schema";
import {
  requirePermission,
  requireActionPermission,
} from "@/lib/auth/rbac";
import {
  STAFF_ROLES,
  type StaffRole,
  hasPermission,
} from "@/lib/auth/permissions";
import {
  deriveUserStatus,
  logActivity,
} from "@/lib/services/activity.service";
import { revalidatePath } from "next/cache";

function parseStaffRole(input: string, fallback: StaffRole = "editor"): StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(input)
    ? (input as StaffRole)
    : fallback;
}

export async function getAdminsAction() {
  await requirePermission("staff:read");

  const allStaff = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isLocked: users.isLocked,
      addedAt: users.createdAt,
      lastActiveAt: users.lastActiveAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .where(and(inArray(users.role, [...STAFF_ROLES]), isNull(users.deletedAt)))
    .orderBy(asc(users.createdAt));

  return allStaff.map((member) => ({
    id: member.id,
    name: member.name || member.email || "Staff",
    email: member.email || "",
    role: member.role,
    status: member.isLocked ? "blocked" : "active",
    addedAt: member.addedAt.toISOString(),
    lastActiveAt: (member.lastActiveAt ?? member.lastLoginAt)?.toISOString() ?? null,
  }));
}

export async function addAdminAction(formData: FormData) {
  const actor = await requireActionPermission("staff:manage");

  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const role = parseStaffRole(formData.get("role") as string, "editor");

  if (!email || !name) throw new Error("Name and email are required");

  const existingUser = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser.length > 0) {
    if (existingUser[0].id === actor.id && role !== "admin") {
      throw new Error("Cannot downgrade your own admin role.");
    }
    await db
      .update(users)
      .set({ role, name })
      .where(eq(users.id, existingUser[0].id));

    await logActivity({
      actorId: actor.id,
      targetUserId: existingUser[0].id,
      action: "admin_staff_added",
      entityType: "user",
      entityId: existingUser[0].id,
      metadata: { email, role, previousRole: existingUser[0].role },
    });
  } else {
    const [created] = await db
      .insert(users)
      .values({
        name,
        email,
        role,
        isLocked: false,
      })
      .returning({ id: users.id });

    await logActivity({
      actorId: actor.id,
      targetUserId: created.id,
      action: "admin_staff_added",
      entityType: "user",
      entityId: created.id,
      metadata: { email, role },
    });
  }

  revalidatePath("/admin/settings");
}

export async function toggleAdminBlockAction(userId: string, isLocked: boolean) {
  const actor = await requireActionPermission("staff:manage");

  if (userId === actor.id) {
    throw new Error("لا يمكنك حظر حسابك الشخصي.");
  }

  await db.transaction(async (tx) => {
    const target = await tx
      .select({ role: users.role, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!target[0]) throw new Error("User not found");

    if (isLocked && target[0].role === "admin") {
      const activeAdmins = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.role, "admin"), eq(users.isLocked, false), isNull(users.deletedAt)));
      if (activeAdmins.length <= 1) {
        throw new Error("لا يمكن حظر المسؤول النشط الوحيد في النظام.");
      }
    }

    await tx.update(users).set({ isLocked }).where(eq(users.id, userId));
  });

  await logActivity({
    actorId: actor.id,
    targetUserId: userId,
    action: isLocked ? "admin_staff_blocked" : "admin_staff_unblocked",
    entityType: "user",
    entityId: userId,
  });

  revalidatePath("/admin/settings");
}

export async function removeAdminAction(userId: string) {
  const actor = await requireActionPermission("staff:manage");

  if (userId === actor.id) {
    throw new Error("لا يمكنك إزالة صلاحياتك الإدارية بنفسك.");
  }

  await db.transaction(async (tx) => {
    const target = await tx
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!target[0]) throw new Error("User not found");

    if (target[0].role === "admin") {
      const admins = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.role, "admin"), isNull(users.deletedAt)));
      if (admins.length <= 1) {
        throw new Error("لا يمكن حذف المسؤول الوحيد في النظام. يجب أن يبقى مسؤول واحد على الأقل.");
      }
    }

    await tx.update(users).set({ role: "user" }).where(eq(users.id, userId));
  });

  await logActivity({
    actorId: actor.id,
    targetUserId: userId,
    action: "admin_staff_removed",
    entityType: "user",
    entityId: userId,
  });

  revalidatePath("/admin/settings");
}

export async function editAdminAction(formData: FormData) {
  const actor = await requireActionPermission("staff:manage");

  const userId = formData.get("userId") as string;
  const name = (formData.get("name") as string)?.trim();
  const role = parseStaffRole(formData.get("role") as string, "editor");

  if (!userId || !name) throw new Error("User ID and name are required");

  if (userId === actor.id && role !== "admin") {
    throw new Error("لا يمكنك تخفيض صلاحيتك الإدارية بنفسك.");
  }

  await db.transaction(async (tx) => {
    if (role !== "admin") {
      const current = await tx
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (current[0]?.role === "admin") {
        const admins = await tx
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.role, "admin"), isNull(users.deletedAt)));
        if (admins.length <= 1) {
          throw new Error("لا يمكن تخفيض صلاحية المسؤول الوحيد في النظام.");
        }
      }
    }

    await tx.update(users).set({ name, role }).where(eq(users.id, userId));
  });

  await logActivity({
    actorId: actor.id,
    targetUserId: userId,
    action: "admin_staff_updated",
    entityType: "user",
    entityId: userId,
    metadata: { name, role },
  });

  revalidatePath("/admin/settings");
}

export async function getUsersListAction(
  page = 1,
  searchQuery = "",
  filterType = "all",
  sortType = "newest"
) {
  await requirePermission("users:read");

  const safePage = Math.max(1, page);
  const limit = 10;
  const offset = (safePage - 1) * limit;

  const baseConditions = [eq(users.role, "user"), isNull(users.deletedAt)];
  const conditions = [...baseConditions];

  if (searchQuery.trim()) {
    const pattern = `%${searchQuery.trim()}%`;
    conditions.push(or(ilike(users.name, pattern), ilike(users.email, pattern))!);
  }

  if (filterType === "pro") {
    conditions.push(eq(users.subscriptionPlan, "pro"));
  } else if (filterType === "locked") {
    conditions.push(eq(users.isLocked, true));
  } else if (filterType === "active") {
    conditions.push(
      and(
        eq(users.isLocked, false),
        sql`COALESCE(${users.lastActiveAt}, ${users.lastLoginAt}) >= now() - INTERVAL '7 days'`
      )!
    );
  } else if (filterType === "inactive") {
    conditions.push(
      and(
        eq(users.isLocked, false),
        sql`(COALESCE(${users.lastActiveAt}, ${users.lastLoginAt}) IS NULL OR COALESCE(${users.lastActiveAt}, ${users.lastLoginAt}) < now() - INTERVAL '30 days')`
      )!
    );
  }

  const whereClause = and(...conditions);

  const [totalCountResult, summaryCountsResult] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(users).where(whereClause),
    db
      .select({
        totalUsers: sql<number>`count(*)::int`,
        active7d: sql<number>`count(*) FILTER (WHERE ${users.isLocked} = false AND COALESCE(${users.lastActiveAt}, ${users.lastLoginAt}) >= now() - INTERVAL '7 days')::int`,
        blocked: sql<number>`count(*) FILTER (WHERE ${users.isLocked} = true)::int`,
        inactive: sql<number>`count(*) FILTER (WHERE ${users.isLocked} = false AND (COALESCE(${users.lastActiveAt}, ${users.lastLoginAt}) IS NULL OR COALESCE(${users.lastActiveAt}, ${users.lastLoginAt}) < now() - INTERVAL '30 days'))::int`,
      })
      .from(users)
      .where(and(...baseConditions)),
  ]);

  const totalCount = Number(totalCountResult[0].count);
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  let orderByClause;
  if (sortType === "recent_active" || sortType === "recent_login") {
    orderByClause = sql`COALESCE(${users.lastActiveAt}, ${users.lastLoginAt}) DESC NULLS LAST, ${users.createdAt} DESC`;
  } else if (sortType === "oldest") {
    orderByClause = asc(users.createdAt);
  } else {
    orderByClause = desc(users.createdAt);
  }

  const result = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isLocked: users.isLocked,
      isSubscribed: users.isSubscribed,
      plan: users.subscriptionPlan,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      lastActiveAt: users.lastActiveAt,
      aiRequestsCurrentPeriod: users.aiRequestsCurrentPeriod,
      subscriptionExpiresAt: users.subscriptionExpiresAt,
      aiTokensUsedCurrentPeriod: users.aiTokensUsedCurrentPeriod,
      organizations: sql<number>`(
        SELECT count(*)::int FROM "organizations" WHERE "owner_id" = "users"."id" AND "deleted_at" IS NULL
      )`,
      games: sql<number>`(
        SELECT count(*)::int FROM "games" WHERE "owner_id" = "users"."id" AND "deleted_at" IS NULL
      )`,
      totalPlayers: sql<number>`COALESCE((
        SELECT sum("play_count")::int FROM "games" WHERE "owner_id" = "users"."id" AND "deleted_at" IS NULL
      ), 0)`,
      lifetimeAiRequests: sql<number>`(
        SELECT count(*)::int FROM "usage_events" WHERE "user_id" = "users"."id" AND "activity" = 'ai_generation'
      )`,
      lifetimeAiTokens: sql<number>`COALESCE((
        SELECT sum("tokens_used")::int FROM "usage_events" WHERE "user_id" = "users"."id" AND "activity" = 'ai_generation'
      ), 0)`,
    })
    .from(users)
    .where(whereClause)
    .limit(limit)
    .offset(offset)
    .orderBy(orderByClause);

  const now = new Date();
  const mappedUsers = result.map((u) => {
    const derived = deriveUserStatus({
      isLocked: u.isLocked,
      lastActiveAt: u.lastActiveAt,
      lastLoginAt: u.lastLoginAt,
      now,
    });

    return {
      ...u,
      name: u.name || u.email || "User",
      status: derived.accountStatus === "blocked" ? "locked" : "active",
      accountStatus: derived.accountStatus,
      activityStatus: derived.activityStatus,
      plan: u.plan || "free",
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
      lastActiveAt: derived.effectiveLastActiveAt
        ? derived.effectiveLastActiveAt.toISOString()
        : null,
      subscriptionExpiresAt: u.subscriptionExpiresAt
        ? u.subscriptionExpiresAt.toISOString()
        : null,
    };
  });

  return {
    users: mappedUsers,
    totalPages,
    currentPage: safePage,
    summary: summaryCountsResult[0] ?? {
      totalUsers: 0,
      active7d: 0,
      blocked: 0,
      inactive: 0,
    },
  };
}

export async function getUserActivityDetailsAction(userId: string) {
  await requireActionPermission("users:read");

  const [recentLogs, recentGames, recentPlays, recentAiUsage] = await Promise.all([
    db
      .select({
        id: activityLogs.id,
        action: activityLogs.action,
        entityType: activityLogs.entityType,
        metadata: activityLogs.metadata,
        createdAt: activityLogs.createdAt,
        actorId: activityLogs.actorId,
        actorName: users.name,
      })
      .from(activityLogs)
      .leftJoin(users, eq(activityLogs.actorId, users.id))
      .where(or(eq(activityLogs.actorId, userId), eq(activityLogs.targetUserId, userId)))
      .orderBy(desc(activityLogs.createdAt))
      .limit(20)
      .catch(() => []),

    db
      .select({
        id: games.id,
        title: games.title,
        status: games.status,
        playCount: games.playCount,
        createdAt: games.createdAt,
      })
      .from(games)
      .where(and(eq(games.ownerId, userId), isNull(games.deletedAt)))
      .orderBy(desc(games.createdAt))
      .limit(5),

    db
      .select({
        id: classroomPlays.id,
        status: classroomPlays.status,
        createdAt: classroomPlays.createdAt,
        gameTitle: games.title,
      })
      .from(classroomPlays)
      .innerJoin(games, eq(classroomPlays.gameId, games.id))
      .where(eq(classroomPlays.teacherId, userId))
      .orderBy(desc(classroomPlays.createdAt))
      .limit(5),

    db
      .select({
        id: usageEvents.id,
        tokensUsed: usageEvents.tokensUsed,
        metadata: usageEvents.metadata,
        createdAt: usageEvents.createdAt,
      })
      .from(usageEvents)
      .where(and(eq(usageEvents.userId, userId), eq(usageEvents.activity, "ai_generation")))
      .orderBy(desc(usageEvents.createdAt))
      .limit(5),
  ]);

  // If activity_logs has no historical rows for this user yet, synthesize an
  // initial fallback timeline from games/plays/usage_events so past actions remain visible.
  type TimelineEntry = {
    id: string;
    action: string;
    detail: string | null;
    actorName: string | null;
    createdAt: string;
  };

  let timeline: TimelineEntry[] = recentLogs.map((log) => ({
    id: log.id,
    action: log.action,
    detail:
      (log.metadata as Record<string, any>)?.title ||
      (log.metadata as Record<string, any>)?.name ||
      (log.metadata as Record<string, any>)?.plan ||
      null,
    actorName: log.actorId && log.actorId !== userId ? log.actorName : null,
    createdAt: log.createdAt.toISOString(),
  }));

  if (timeline.length === 0) {
    const synthesized: TimelineEntry[] = [
      ...recentGames.map((g) => ({
        id: `game-${g.id}`,
        action: g.status === "published" ? "game_published" : "game_created",
        detail: g.title,
        actorName: null,
        createdAt: g.createdAt.toISOString(),
      })),
      ...recentPlays.map((p) => ({
        id: `play-${p.id}`,
        action: "session_started",
        detail: p.gameTitle,
        actorName: null,
        createdAt: p.createdAt.toISOString(),
      })),
      ...recentAiUsage.map((u) => ({
        id: `ai-${u.id}`,
        action:
          (u.metadata as Record<string, any>)?.action === "generateGameStream"
            ? "ai_game_generated"
            : "ai_text_generated",
        detail: `${u.tokensUsed ?? 0} tokens`,
        actorName: null,
        createdAt: (u.createdAt ?? new Date()).toISOString(),
      })),
    ];
    synthesized.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    timeline = synthesized.slice(0, 15);
  }

  return {
    timeline,
    recentGames: recentGames.map((g) => ({
      ...g,
      createdAt: g.createdAt.toISOString(),
    })),
  };
}

export async function addNormalUserAction(formData: FormData) {
  const actor = await requireActionPermission("users:create");
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const requestedPlan = formData.get("plan") as string;

  if (!email || !name) throw new Error("Name and email required");

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length > 0) throw new Error("User with this email already exists");

  const canAssignPro = hasPermission(actor.role, "users:billing");
  const isPro = canAssignPro && requestedPlan === "pro";

  const [created] = await db
    .insert(users)
    .values({
      name,
      email,
      role: "user",
      isLocked: false,
      isSubscribed: isPro,
      subscriptionPlan: isPro ? "pro" : null,
    })
    .returning({ id: users.id });

  await logActivity({
    actorId: actor.id,
    targetUserId: created.id,
    action: "admin_user_created",
    entityType: "user",
    entityId: created.id,
    metadata: { email, plan: isPro ? "pro" : "free" },
  });

  revalidatePath("/admin/accounts");
}

export async function toggleUserBlockAction(userId: string, isLocked: boolean) {
  const actor = await requireActionPermission("users:block");

  const updated = await db
    .update(users)
    .set({ isLocked })
    .where(and(eq(users.id, userId), eq(users.role, "user")))
    .returning({ id: users.id });

  if (updated.length === 0) {
    throw new Error("User not found or cannot be blocked from this view.");
  }

  await logActivity({
    actorId: actor.id,
    targetUserId: userId,
    action: isLocked ? "admin_user_blocked" : "admin_user_unblocked",
    entityType: "user",
    entityId: userId,
  });

  revalidatePath("/admin/accounts");
  revalidatePath("/admin/analytics");
}

export async function toggleUserSubscriptionAction(userId: string, isSubscribed: boolean) {
  const actor = await requireActionPermission("users:billing");

  const updated = await db
    .update(users)
    .set({
      isSubscribed,
      subscriptionPlan: isSubscribed ? "pro" : null,
    })
    .where(and(eq(users.id, userId), eq(users.role, "user")))
    .returning({ id: users.id });

  if (updated.length === 0) {
    throw new Error("User not found.");
  }

  await logActivity({
    actorId: actor.id,
    targetUserId: userId,
    action: "admin_user_plan_changed",
    entityType: "user",
    entityId: userId,
    metadata: { plan: isSubscribed ? "pro" : "free" },
  });

  revalidatePath("/admin/accounts");
  revalidatePath("/admin/analytics");
}

export async function deleteUserAction(userId: string) {
  const actor = await requireActionPermission("users:delete");

  const target = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.role, "user")))
    .limit(1);

  if (!target[0]) {
    throw new Error("User not found or cannot be deleted here.");
  }

  // Record audit entry with targetUserId=null so CASCADE deletion doesn't wipe it
  await logActivity({
    actorId: actor.id,
    targetUserId: null,
    action: "admin_user_deleted",
    entityType: "user",
    entityId: userId,
    metadata: {
      deletedEmail: target[0].email,
      deletedName: target[0].name,
    },
  });

  await db
    .delete(users)
    .where(and(eq(users.id, userId), eq(users.role, "user")));

  revalidatePath("/admin/accounts");
  revalidatePath("/admin/analytics");
}
