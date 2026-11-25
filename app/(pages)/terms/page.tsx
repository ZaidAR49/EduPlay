import type { Metadata } from "next"
import { Navbar } from "@/components/shared/Navbar"
import { Footer } from "@/components/shared/Footer"
import { TermsContent } from "@/components/legal/TermsContent"
import { getPublicSupportEmail } from "@/lib/emails/email-config"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms governing EduPlay educator accounts, AI-generated quiz verification, fair usage quotas, subscriptions, and acceptable use.",
}

export default function TermsPage() {
  const supportEmail = getPublicSupportEmail()

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Navbar />
      <TermsContent supportEmail={supportEmail} />
      <Footer />
    </main>
  )
}
