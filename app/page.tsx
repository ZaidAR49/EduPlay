import type { Metadata } from "next"
import { Navbar } from "@/components/shared/Navbar"
import { HeroSection } from "@/components/home/HeroSection"
import { FeaturesSection } from "@/components/home/FeaturesSection"
import { HowItWorksSection } from "@/components/home/HowItWorksSection"
import { CallToAction } from "@/components/home/CallToAction"
import { FAQSection } from "@/components/home/FAQSection"
import { ContactCTA } from "@/components/home/ContactCTA"
import { Footer } from "@/components/shared/Footer"
import { JsonLd } from "@/components/seo/JsonLd"
import { getPublicSupportEmail } from "@/lib/emails/email-config"
import { buildHomeJsonLd, buildPublicMetadata, getRequestLocale } from "@/lib/seo"

interface HomePageProps {
  searchParams: Promise<{ lang?: string | string[] }>
}

export async function generateMetadata({ searchParams }: HomePageProps): Promise<Metadata> {
  const { lang } = await searchParams
  const { locale, hasUrlLocale } = await getRequestLocale(lang)
  return buildPublicMetadata({
    page: "home",
    path: "/",
    locale,
    hasUrlLocale,
    useAbsoluteTitle: true,
  })
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { lang } = await searchParams
  const { locale } = await getRequestLocale(lang)
  const supportEmail = getPublicSupportEmail()
  const homeJsonLd = buildHomeJsonLd(locale, supportEmail || undefined)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <JsonLd data={homeJsonLd} />
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <CallToAction />
        <FAQSection />
        <ContactCTA />
      </main>
      <Footer />
    </div>
  )
}
