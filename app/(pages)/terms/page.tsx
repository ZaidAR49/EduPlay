import type { Metadata } from "next"
import { Navbar } from "@/components/shared/Navbar"
import { Footer } from "@/components/shared/Footer"
import { TermsContent } from "@/components/legal/TermsContent"
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

interface TermsPageProps {
  searchParams: Promise<{ lang?: string | string[] }>
}

export async function generateMetadata({ searchParams }: TermsPageProps): Promise<Metadata> {
  const { lang } = await searchParams
  const { locale, hasUrlLocale } = await getRequestLocale(lang)
  return buildPublicMetadata({
    page: "terms",
    path: "/terms",
    locale,
    hasUrlLocale,
  })
}

export default async function TermsPage({ searchParams }: TermsPageProps) {
  const { lang } = await searchParams
  const { locale } = await getRequestLocale(lang)
  const supportEmail = getPublicSupportEmail()
  const siteUrl = getSiteUrl()
  const copy = getSeoCopy(locale)

  const termsJsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: copy.pages.terms.title,
      description: copy.pages.terms.description,
      url: `${siteUrl}/terms`,
      inLanguage: locale,
    },
    buildBreadcrumbJsonLd([
      { name: locale === "ar" ? "الرئيسية" : "Home", path: "/" },
      { name: copy.pages.terms.title, path: "/terms" },
    ]),
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <JsonLd data={termsJsonLd} />
      <Navbar />
      <main className="flex-1 flex flex-col">
        <TermsContent supportEmail={supportEmail} />
      </main>
      <Footer />
    </div>
  )
}
