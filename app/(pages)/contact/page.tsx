import type { Metadata } from "next"
import { Navbar } from "@/components/shared/Navbar"
import { Footer } from "@/components/shared/Footer"
import { ContactClient } from "./ContactClient"
import { JsonLd } from "@/components/seo/JsonLd"
import { getPublicSupportEmail } from "@/lib/emails/email-config"
import {
  buildBreadcrumbJsonLd,
  buildPublicMetadata,
  getRequestLocale,
  getSeoCopy,
  getSiteUrl,
} from "@/lib/seo"

export const dynamic = "force-dynamic"

interface ContactPageProps {
  searchParams: Promise<{ lang?: string | string[] }>
}

export async function generateMetadata({ searchParams }: ContactPageProps): Promise<Metadata> {
  const { lang } = await searchParams
  const { locale, hasUrlLocale } = await getRequestLocale(lang)
  return buildPublicMetadata({
    page: "contact",
    path: "/contact",
    locale,
    hasUrlLocale,
  })
}

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const { lang } = await searchParams
  const { locale } = await getRequestLocale(lang)
  const contactEmail = getPublicSupportEmail()
  const siteUrl = getSiteUrl()
  const copy = getSeoCopy(locale)

  const contactJsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "ContactPage",
      name: copy.pages.contact.title,
      description: copy.pages.contact.description,
      url: `${siteUrl}/contact`,
      inLanguage: locale,
    },
    buildBreadcrumbJsonLd([
      { name: locale === "ar" ? "الرئيسية" : "Home", path: "/" },
      { name: copy.pages.contact.title, path: "/contact" },
    ]),
  ]

  return (
    <div className="min-h-screen flex flex-col font-sans bg-gray-50">
      <JsonLd data={contactJsonLd} />
      <Navbar />
      <main className="flex-1 flex flex-col">
        <ContactClient contactEmail={contactEmail} />
      </main>
      <Footer />
    </div>
  )
}
