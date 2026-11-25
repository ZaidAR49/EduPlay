import type { Metadata } from "next"
import { NotFoundClient } from "@/components/shared/NotFoundClient"
import { NOINDEX_ROBOTS } from "@/lib/seo"

export const metadata: Metadata = {
  title: "Page Not Found",
  robots: NOINDEX_ROBOTS,
}

export default function NotFound() {
  return <NotFoundClient />
}
