import type { Metadata } from "next"
import { UnauthorizedClient } from "./UnauthorizedClient"
import { NOINDEX_ROBOTS } from "@/lib/seo"

export const metadata: Metadata = {
  title: "Access Denied",
  robots: NOINDEX_ROBOTS,
}

export default function UnauthorizedPage() {
  return <UnauthorizedClient />
}
