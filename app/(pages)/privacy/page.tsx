import type { Metadata } from "next"
import { Navbar } from "@/components/shared/Navbar"
import { Footer } from "@/components/shared/Footer"
import { PrivacyContent } from "@/components/legal/PrivacyContent"
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

interface PrivacyPageProps {
  searchParams: Promise<{ lang?: string | string[] }>
}

export async function generateMetadata({ searchParams }: PrivacyPageProps): Promise<Metadata> {
  const { lang } = await searchParams
  const { locale, hasUrlLocale } = await getRequestLocale(lang)
  return buildPublicMetadata({
    page: "privacy",
    path: "/privacy",
    locale,
    hasUrlLocale,
  })
}

export default async function PrivacyPage({ searchParams }: PrivacyPageProps) {
  const { lang } = await searchParams
  const { locale } = await getRequestLocale(lang)
  const supportEmail = getPublicSupportEmail()
  const siteUrl = getSiteUrl()
  const copy = getSeoCopy(locale)

  const privacyJsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: copy.pages.privacy.title,
      description: copy.pages.privacy.description,
      url: `${siteUrl}/privacy`,
      inLanguage: locale,
    },
    buildBreadcrumbJsonLd([
      { name: locale === "ar" ? "الرئيسية" : "Home", path: "/" },
      { name: copy.pages.privacy.title, path: "/privacy" },
    ]),
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <JsonLd data={privacyJsonLd} />
      <Navbar />
      <main className="flex-1 flex flex-col">
        <PrivacyContent supportEmail={supportEmail} />
      </main>
      <Footer />
    </div>
  )
}
