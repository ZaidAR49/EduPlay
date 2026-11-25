import type { Metadata } from "next"
import { Navbar } from "@/components/shared/Navbar"
import { Footer } from "@/components/shared/Footer"
import { PrivacyContent } from "@/components/legal/PrivacyContent"
import { getPublicSupportEmail } from "@/lib/emails/email-config"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How EduPlay protects student anonymity, processes AI game-generation prompts, handles data retention, and safeguards educator accounts.",
}

export default function PrivacyPage() {
  const supportEmail = getPublicSupportEmail()

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Navbar />
      <PrivacyContent supportEmail={supportEmail} />
      <Footer />
    </main>
  )
}
