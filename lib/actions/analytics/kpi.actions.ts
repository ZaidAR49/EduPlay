"use server";

import { db } from "@/lib/db";
import { users, games, classroomPlays, players, usageEvents } from "@/lib/db/schema";
import { eq, count, and, sql, isNull, or, gt } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/rbac";
import { unstable_noStore as noStore } from "next/cache";

/** KPI stat cards (DB for absolute totals, excluding blocked/deleted inaccuracies) */
export async function getAdminKpiAction() {
  noStore();
  await requirePermission("analytics:read");

  const now = new Date();
  const [
    userCounts,
    proUsers,
    gameCounts,
    totalSessions,
    recentPlayers,
    completedPlayers,
  ] = await Promise.all([
    db
      .select({
        totalUsers: count(),
        activeUsers7d: sql<number>`count(*) FILTER (WHERE ${users.isLocked} = false AND COALESCE(${users.lastActiveAt}, ${users.lastLoginAt}) >= now() - INTERVAL '7 days')::int`,
        blockedUsers: sql<number>`count(*) FILTER (WHERE ${users.isLocked} = true)::int`,
      })
      .from(users)
      .where(and(eq(users.role, "user"), isNull(users.deletedAt))),

    db
      .select({ count: count() })
      .from(users)
      .where(
        and(
          eq(users.role, "user"),
          eq(users.isSubscribed, true),
          eq(users.isLocked, false),
          isNull(users.deletedAt),
          or(isNull(users.subscriptionExpiresAt), gt(users.subscriptionExpiresAt, now))
        )
      ),

    db
      .select({
        totalGames: count(),
        publishedGames: sql<number>`count(*) FILTER (WHERE ${games.status} = 'published')::int`,
        lifetimePlays: sql<number>`COALESCE(SUM(${games.playCount}), 0)::int`,
      })
      .from(games)
      .where(isNull(games.deletedAt)),

    db.select({ count: count() }).from(classroomPlays),
    db.select({ count: count() }).from(players),
    db.select({ count: count() }).from(players).where(eq(players.isFinished, true)),
  ]);

  const recentPlayerCount = recentPlayers[0].count;
  const lifetimePlays = Number(gameCounts[0]?.lifetimePlays ?? 0);

  return {
    totalUsers: userCounts[0]?.totalUsers ?? 0,
    activeUsers7d: Number(userCounts[0]?.activeUsers7d ?? 0),
    blockedUsers: Number(userCounts[0]?.blockedUsers ?? 0),
    proUsers: proUsers[0].count,
    totalGames: gameCounts[0]?.totalGames ?? 0,
    publishedGames: Number(gameCounts[0]?.publishedGames ?? 0),
    totalSessions: totalSessions[0].count,
    totalPlayers: Math.max(lifetimePlays, recentPlayerCount),
    recentPlayersCount: recentPlayerCount,
    completionRate:
      recentPlayerCount > 0
        ? Math.round((completedPlayers[0].count / recentPlayerCount) * 100)
        : null,
  };
}

/** Game status breakdown (DB) */
export async function getGameStatusBreakdownAction() {
  noStore();
  await requirePermission("analytics:read");

  const rows = await db
    .select({ status: games.status, count: count() })
    .from(games)
    .where(isNull(games.deletedAt))
    .groupBy(games.status);

  const STATUS_LABELS: Record<string, string> = {
    draft: "مسودة",
    published: "منشورة",
    archived: "مؤرشفة",
  };

  return rows.map((r) => ({
    name: STATUS_LABELS[r.status] ?? r.status,
    key: r.status,
    value: r.count,
  }));
}

/** Total AI tokens used platform-wide */
export async function getPlatformAiUsageAction() {
  noStore();
  await requirePermission("analytics:read");

  const data = await db
    .select({
      totalTokens: sql<number>`COALESCE(SUM(${usageEvents.tokensUsed}), 0)`,
    })
    .from(usageEvents)
    .where(eq(usageEvents.activity, "ai_generation"));

  return data[0]?.totalTokens || 0;
}
