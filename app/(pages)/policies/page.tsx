import { redirect } from "next/navigation"

/**
 * Legacy combined policy route redirected to the dedicated Privacy Policy page.
 */
export default function PoliciesPage() {
  redirect("/privacy")
}
