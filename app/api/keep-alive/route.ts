import { NextResponse } from "next/server";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { classroomPlays, games, players } from "@/lib/db/schema";
import { config } from "@/lib/config";
import { supabase } from "@/lib/supabase-client";

export const dynamic = "force-dynamic";

const PLAYER_RETENTION_DAYS = 30;

/**
 * Runs lightweight, indexed table reads across both Supabase PostgREST and
 * the Drizzle Postgres pooler so Supabase registers genuine database activity
 * without adding load.
 */
async function pingDatabase(): Promise<void> {
  const [restResult] = await Promise.all([
    supabase.from("system_announcements").select("id").limit(1),
    db.select({ id: games.id }).from(games).limit(1),
  ]);

  if (restResult.error) {
    throw new Error(`Supabase REST ping failed: ${restResult.error.message}`);
  }
}

/**
 * Performs daily maintenance: prunes old anonymous player rows and closes
 * stale live sessions that have exceeded maxLiveDurationMs.
 */
async function runDailyCleanup(): Promise<{ closedSessionsCount: number }> {
  const retentionCutoff = new Date();
  retentionCutoff.setDate(retentionCutoff.getDate() - PLAYER_RETENTION_DAYS);

  await db.delete(players).where(lt(players.createdAt, retentionCutoff));

  const sessionCutoff = new Date(Date.now() - config.session.maxLiveDurationMs);
  const stalePlays = await db
    .select({ id: classroomPlays.id, gameId: classroomPlays.gameId })
    .from(classroomPlays)
    .where(
      and(
        eq(classroomPlays.status, "live"),
        sql`COALESCE(${classroomPlays.startedAt}, ${classroomPlays.createdAt}) < ${sessionCutoff}`
      )
    );

  if (stalePlays.length > 0) {
    const stalePlayIds = stalePlays.map((p) => p.id);
    const staleGameIds = Array.from(new Set(stalePlays.map((p) => p.gameId)));
    const now = new Date();

    await db
      .update(classroomPlays)
      .set({ status: "closed", endedAt: now, updatedAt: now })
      .where(inArray(classroomPlays.id, stalePlayIds));

    await db
      .update(games)
      .set({ status: "draft", updatedAt: now })
      .where(inArray(games.id, staleGameIds));
  }

  return { closedSessionsCount: stalePlays.length };
}

export async function GET(req: Request) {
  // Bug #5 Fix: fail-closed — always require CRON_SECRET to be present and match
  const authHeader = req.headers.get("authorization");
  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runCleanup = new URL(req.url).searchParams.get("cleanup") === "true";

  try {
    await pingDatabase();

    if (runCleanup) {
      const { closedSessionsCount } = await runDailyCleanup();
      return NextResponse.json({
        success: true,
        mode: "cleanup",
        message:
          "Database pinged via PostgREST and Postgres. Pruned stale player records and closed expired sessions.",
        closedSessionsCount,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      mode: "ping",
      message: "Database pinged via PostgREST and Postgres.",
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error("Database keep alive ping failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to query the database";
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
