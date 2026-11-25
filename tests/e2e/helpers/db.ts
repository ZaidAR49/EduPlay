import crypto from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import * as schema from "../../../lib/db/schema";
import { loadTestEnv } from "./env";

loadTestEnv();

export type TestUserRole = "user" | "viewer" | "editor" | "admin";

export interface CreatedTestUser {
  id: string;
  name: string;
  email: string;
  role: TestUserRole;
  isLocked: boolean;
}

let sqlClient: ReturnType<typeof postgres> | null = null;

function getTestDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL must be set to run E2E database helpers.");
  }

  if (!sqlClient) {
    sqlClient = postgres(connectionString, {
      prepare: false,
      max: 5,
      onnotice: () => {},
    });
  }

  return drizzle(sqlClient, { schema });
}

export async function closeTestDb(): Promise<void> {
  if (sqlClient) {
    await sqlClient.end({ timeout: 5 });
    sqlClient = null;
  }
}

export async function createTestUser(options?: {
  name?: string;
  email?: string;
  role?: TestUserRole;
  isLocked?: boolean;
  isSubscribed?: boolean;
  locale?: "ar" | "en";
}): Promise<CreatedTestUser> {
  const db = getTestDb();
  const suffix = crypto.randomBytes(4).toString("hex");
  const role: TestUserRole = options?.role ?? "user";
  const email = options?.email ?? `e2e-${role}-${suffix}@eduplay.test`;
  const name = options?.name ?? `E2E ${role} ${suffix}`;
  const isLocked = options?.isLocked ?? false;

  const [created] = await db
    .insert(schema.users)
    .values({
      name,
      email,
      role,
      isLocked,
      isSubscribed: options?.isSubscribed ?? false,
      locale: options?.locale ?? "ar",
    })
    .returning({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.users.role,
      isLocked: schema.users.isLocked,
    });

  return {
    id: created.id,
    name: created.name ?? name,
    email: created.email ?? email,
    role: created.role,
    isLocked: created.isLocked,
  };
}

export async function deleteTestUser(userId: string): Promise<void> {
  const db = getTestDb();
  await db.delete(schema.users).where(eq(schema.users.id, userId));
}

export async function createTestOrganization(ownerId: string, name?: string) {
  const db = getTestDb();
  const suffix = crypto.randomBytes(3).toString("hex");

  const [org] = await db
    .insert(schema.organizations)
    .values({
      ownerId,
      name: name ?? `E2E Org ${suffix}`,
    })
    .returning();

  return org;
}

export async function createPublishedTestGame(params: {
  ownerId: string;
  organizationId?: string | null;
  title?: string;
  slug?: string;
}) {
  const db = getTestDb();
  const suffix = crypto.randomBytes(4).toString("hex");

  const [game] = await db
    .insert(schema.games)
    .values({
      ownerId: params.ownerId,
      organizationId: params.organizationId ?? null,
      title: params.title ?? `E2E Live Game ${suffix}`,
      description: "Automated Playwright regression game",
      slug: params.slug ?? `e2e-live-${suffix}`,
      icon: "🧪",
      status: "published",
      language: "ar",
      maxPoints: 10,
    })
    .returning();

  const [scenario] = await db
    .insert(schema.scenarios)
    .values({
      gameId: game.id,
      orderIndex: 0,
      icon: "❓",
      title: "سؤال تجريبي",
      description: "ما هو الخيار الصحيح في الاختبار؟",
    })
    .returning();

  await db.insert(schema.choices).values([
    {
      scenarioId: scenario.id,
      orderIndex: 0,
      text: "الإجابة الصحيحة E2E",
      icon: "✅",
      isCorrect: true,
      feedbackTitle: "أحسنت!",
      feedbackMessage: "إجابة صحيحة تماماً.",
      feedbackTip: "تلميح الاختبار",
      points: 10,
    },
    {
      scenarioId: scenario.id,
      orderIndex: 1,
      text: "الإجابة الخاطئة E2E",
      icon: "❌",
      isCorrect: false,
      feedbackTitle: "حاول مجدداً",
      feedbackMessage: "هذه ليست الإجابة الصحيحة.",
      feedbackTip: "تلميح آخر",
      points: 0,
    },
  ]);

  const [play] = await db
    .insert(schema.classroomPlays)
    .values({
      gameId: game.id,
      teacherId: params.ownerId,
      status: "live",
      startedAt: new Date(),
    })
    .returning();

  return { game, scenario, play };
}

export async function createClosedTestSession(params: {
  ownerId: string;
  organizationId?: string | null;
  gameTitle?: string;
  playerName?: string;
}) {
  const db = getTestDb();
  const { game, play } = await createPublishedTestGame({
    ownerId: params.ownerId,
    organizationId: params.organizationId,
    title: params.gameTitle ?? `E2E History Game ${crypto.randomBytes(3).toString("hex")}`,
  });

  // Insert player while play is still 'live' to satisfy enforce_play_live trigger
  const [player] = await db
    .insert(schema.players)
    .values({
      classroomPlayId: play.id,
      name: params.playerName ?? `طالب سجل ${crypto.randomBytes(2).toString("hex")}`,
      totalScore: 10,
      totalCorrectAnswers: 1,
      totalWrongAnswers: 0,
      isFinished: true,
      startedAt: new Date(Date.now() - 12_000),
      completedAt: new Date(),
    })
    .returning();

  // Close play and mark game draft so it appears cleanly in Sessions History
  await db
    .update(schema.classroomPlays)
    .set({ status: "closed", endedAt: new Date() })
    .where(eq(schema.classroomPlays.id, play.id));

  await db
    .update(schema.games)
    .set({ status: "draft" })
    .where(eq(schema.games.id, game.id));

  return { game, play, player };
}

export async function deleteSystemAnnouncementsByTitle(title: string): Promise<void> {
  const db = getTestDb();
  await db.delete(schema.systemAnnouncements).where(eq(schema.systemAnnouncements.title, title));
}

export async function getOrganizationsByOwner(ownerId: string) {
  const db = getTestDb();
  return db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.ownerId, ownerId));
}

export async function getGamesByOwner(ownerId: string) {
  const db = getTestDb();
  return db
    .select()
    .from(schema.games)
    .where(eq(schema.games.ownerId, ownerId));
}

export async function doesS3ObjectExist(publicUrl: string): Promise<boolean> {
  const bucket = process.env.SUPABASE_S3_BUCKET;
  const endpoint = process.env.SUPABASE_S3_ENDPOINT;
  const accessKeyId = process.env.SUPABASE_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.SUPABASE_S3_SECRET_ACCESS_KEY;

  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) {
    return false;
  }

  const marker = `/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return false;
  const key = publicUrl.slice(idx + marker.length);

  const client = new S3Client({
    forcePathStyle: true,
    region: process.env.SUPABASE_S3_REGION || "local",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });

  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}
