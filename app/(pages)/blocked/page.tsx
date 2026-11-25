import { BlockedClient } from "./BlockedClient";
import { getPublicSupportEmail } from "@/lib/emails/email-config";

export const dynamic = "force-dynamic";

export default async function BlockedPage() {
  const supportEmail = getPublicSupportEmail() || "support@example.com";

  return <BlockedClient supportEmail={supportEmail} />;
}
