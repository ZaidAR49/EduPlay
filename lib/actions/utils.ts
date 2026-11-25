import { auth } from "@/auth";
import * as gamesService from "@/lib/services/games.service";
import * as scenariosService from "@/lib/services/scenarios.service";
import * as organizationsService from "@/lib/services/organizations.service";

import { redirect } from "next/navigation";
import { cache } from "react";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isStaffRole } from "@/lib/auth/permissions";
import { touchUserLastActive } from "@/lib/services/activity.service";

/**
 * Ensures the user is authenticated and not blocked, redirecting otherwise.
 * Also throttles updates to users.last_active_at using the single DB lookup.
 */
export const requireAuth = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/signin");
  }

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session.user.id);
    const dbUser = await db.query.users.findFirst({
      where: isUuid ? eq(users.id, session.user.id) : eq(users.email, session.user.email!),
      columns: {
        id: true,
        isLocked: true,
        deletedAt: true,
        role: true,
        isSubscribed: true,
        subscriptionPlan: true,
        locale: true,
        lastActiveAt: true,
      }
    });

    if (dbUser?.isLocked) {
      redirect("/blocked");
    }
    if (dbUser?.deletedAt) {
      redirect("/unauthorized");
    }

    const userId = dbUser?.id ?? session.user.id;
    await touchUserLastActive(userId, dbUser?.lastActiveAt);

    const role = dbUser?.role || (session.user as any).role || "user";
    const isStaff = isStaffRole(role);
    const isSubscribed = isStaff || !!dbUser?.isSubscribed;

    return {
      ...session.user,
      id: userId,
      role,
      isLocked: false,
      isSubscribed,
      subscriptionPlan: isSubscribed ? (dbUser?.subscriptionPlan ?? "pro") : null,
      locale: dbUser?.locale || "ar",
    } as typeof session.user & { id: string, role: string, isLocked: boolean, isSubscribed: boolean, subscriptionPlan: string | null, locale: string };
  } catch (error) {
    console.error("[requireAuth] DB lookup failed, falling back to JWT session:", error);

    if ((session.user as any).isLocked) {
      redirect("/blocked");
    }

    const role = (session.user as any).role ?? "user";
    const isStaff = isStaffRole(role);

    return {
      ...session.user,
      role,
      isLocked: false,
      isSubscribed: isStaff,
      subscriptionPlan: isStaff ? "pro" : null,
      locale: "ar",
    } as typeof session.user & { id: string, role: string, isLocked: boolean, isSubscribed: boolean, subscriptionPlan: string | null, locale: string };
  }
});

/**
 * Verifies if the user is the owner of the given game.
 * Throws an error if not authorized.
 */
export async function verifyGameOwnership(gameId: string, userId: string) {
  const game = await gamesService.getGameById(gameId);
  if (!game) throw new Error("Game not found");
  if (game.ownerId !== userId) throw new Error("Unauthorized: You do not own this game.");
  return game;
}

/**
 * Verifies if the user is the owner of the organization.
 * Throws an error if not authorized.
 */
export async function verifyOrganizationOwnership(orgId: string, userId: string) {
  const org = await organizationsService.getOrganizationById(orgId);
  if (!org) throw new Error("Organization not found");
  if (org.ownerId !== userId) throw new Error("Unauthorized: You do not own this organization.");
  return org;
}

/**
 * Verifies if the user is the owner of the game the scenario belongs to.
 * Throws an error if not authorized.
 */
export async function verifyScenarioOwnership(scenarioId: string, userId: string) {
  const scenario = await scenariosService.getScenarioById(scenarioId);
  if (!scenario) throw new Error("Scenario not found");
  await verifyGameOwnership(scenario.gameId, userId);
  return scenario;
}

/**
 * Verifies if the user is the owner of the game the choice belongs to (via scenario).
 * Throws an error if not authorized.
 */
export async function verifyChoiceOwnership(choiceId: string, userId: string) {
  const { getChoiceById } = await import("@/lib/services/choices.service");
  const choice = await getChoiceById(choiceId);
  if (!choice) throw new Error("Choice not found");
  await verifyScenarioOwnership(choice.scenarioId, userId);
  return choice;
}
