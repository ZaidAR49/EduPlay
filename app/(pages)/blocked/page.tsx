import type { Metadata } from "next";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { BlockedClient } from "./BlockedClient";
import { NOINDEX_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Account Suspended",
  robots: NOINDEX_ROBOTS,
};

export default async function BlockedPage() {
  const primaryAdmin = await db.query.users.findFirst({
    where: eq(users.role, "admin"),
    columns: { email: true },
  });
  const supportEmail = primaryAdmin?.email || "support@example.com";

  return <BlockedClient supportEmail={supportEmail} />;
}
