import { Navbar } from "@/components/shared/Navbar"
import { Footer } from "@/components/shared/Footer"
import { ContactClient } from "./ContactClient"
import { getPublicSupportEmail } from "@/lib/emails/email-config"

export const dynamic = "force-dynamic"

export default function ContactPage() {
  const contactEmail = getPublicSupportEmail()

  return (
    <main className="flex-1 flex flex-col font-sans bg-gray-50">
      <Navbar />
      <ContactClient contactEmail={contactEmail} />
      <Footer />
    </main>
  )
}
