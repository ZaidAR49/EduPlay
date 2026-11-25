import { permanentRedirect } from "next/navigation"

/**
 * Legacy combined policy route permanently redirected to the dedicated Privacy Policy page.
 */
export default function PoliciesPage() {
  permanentRedirect("/privacy")
}
