import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { users, accounts, sessions, verificationToken } from "@/lib/db/schema"
import { logActivity } from "@/lib/services/activity.service"

const ROLE_SYNC_TTL_MS = 60_000;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const authResult = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: { params: { prompt: "select_account" } },
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: null, // Never persist picture or image URL to database
          role: "user",
        }
      },
    }),
  ],
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationToken,
  }),
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: '/login',
    error: '/auth-error',
  },
  callbacks: {
    async signIn({ user }) {
      if (!user?.email) return true;
      try {
        const dbUser = await db.query.users.findFirst({
          where: (u, { eq: eqOp }) => eqOp(u.email, user.email as string),
          columns: { isLocked: true, deletedAt: true }
        });
        if (dbUser?.isLocked || dbUser?.deletedAt) {
          return false;
        }
      } catch (error) {
        console.error("[auth] signIn DB check failed, allowing sign-in:", error);
      }
      return true;
    },
    async jwt({ token, user, profile, trigger, session }) {
      if (profile) {
        const googlePic = (profile as any)?.picture || (profile as any)?.image;
        if (googlePic) {
          token.image = googlePic;
        }
      }
      if (user) {
        token.id = user.id
        if (!token.image) {
          token.image = user.image || (profile as any)?.picture || (token as any)?.picture
        }
        token.name = user.name
        token.role = user.role
        token.isLocked = Boolean(user.isLocked)
        token.roleSyncedAt = Date.now()
      } else {
        // Periodically refresh role & lock state from DB so blocking takes effect
        // quickly on existing JWT sessions (also refreshes legacy role names).
        const lastSynced = typeof token.roleSyncedAt === "number" ? token.roleSyncedAt : 0;
        const needsSync =
          !token.id ||
          token.role === "super_admin" ||
          Date.now() - lastSynced > ROLE_SYNC_TTL_MS;

        if (needsSync && (token.id || token.email)) {
          try {
            const hasUuid = typeof token.id === "string" && UUID_REGEX.test(token.id);
            const dbUser = await db.query.users.findFirst({
              where: hasUuid
                ? (u, { eq: eqOp }) => eqOp(u.id, token.id as string)
                : (u, { eq: eqOp }) => eqOp(u.email, token.email as string),
              columns: { id: true, role: true, isLocked: true, deletedAt: true }
            });
            if (dbUser) {
              token.id = dbUser.id;
              token.role = dbUser.role;
              token.isLocked = Boolean(dbUser.isLocked || dbUser.deletedAt);
              token.roleSyncedAt = Date.now();
            } else if (!token.id) {
              token.id = token.sub;
            }
          } catch (error) {
            console.error("[auth] jwt DB sync failed:", error);
            if (!token.id) token.id = token.sub;
          }
        }
      }
      if (trigger === "update" && session) {
        const newName = session.name || session.user?.name;
        if (newName) {
          token.name = newName;
        }
      }
      return token
    },
    session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string
        session.user.image = (token.image as string) || (token.picture as string) || null
        session.user.role = token.role as string
        session.user.isLocked = Boolean(token.isLocked)
      }
      return session
    },
  },
  events: {
    async signIn({ user }) {
      if (user?.email) {
        const now = new Date();
        try {
          const updated = await db
            .update(users)
            .set({ lastLoginAt: now, lastActiveAt: now })
            .where(eq(users.email, user.email as string))
            .returning({ id: users.id });
          const userId = updated[0]?.id ?? user.id;
          if (userId) {
            await logActivity({
              actorId: userId,
              targetUserId: userId,
              action: "user_login",
              entityType: "user",
              entityId: userId,
            });
          }
        } catch (error) {
          console.error("[auth] Failed to update login timestamps:", error);
        }
      }
    }
  }
}) 

export const { handlers, signIn, signOut, auth } = authResult;
export const update = (authResult as any).unstable_update || (authResult as any).update;
