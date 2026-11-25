import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthErrorClient } from "./AuthErrorClient";
import { NOINDEX_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Authentication Error",
  robots: NOINDEX_ROBOTS,
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const error = params.error;

  if (error === "AccessDenied") {
    redirect("/blocked");
  }

  return <AuthErrorClient error={error} />;
}
