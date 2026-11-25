import type { Metadata, Viewport } from "next"
import { Tajawal } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { config } from "@/lib/config"
import { Toaster } from "sonner"
import { getCurrentUser } from "@/lib/auth/rbac"
import { PosthogIdentify } from "@/components/shared/PosthogIdentify"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { LanguageProvider } from "@/lib/i18n/LanguageContext"
import { HtmlDirSync } from "@/components/shared/HtmlDirSync"
import { buildRootMetadata, getRequestLocale } from "@/lib/seo"
import "./globals.css"

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "700"],
  display: "swap",
})

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#059669",
}

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getRequestLocale()
  return buildRootMetadata(locale)
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [currentUser, { locale: initialLocale, hasUrlLocale }] = await Promise.all([
    getCurrentUser(),
    getRequestLocale(),
  ])
  const isRTL = initialLocale === "ar"

  return (
    <html
      lang={initialLocale}
      dir={isRTL ? "rtl" : "ltr"}
      className="bg-gradient-to-br from-emerald-50 to-blue-50"
      data-scroll-behavior="smooth"
    >
      <body className={`${tajawal.className} font-sans antialiased`}>
        <LanguageProvider initialLocale={initialLocale} forceInitialLocale={hasUrlLocale}>
          <HtmlDirSync />
          {children}
          {currentUser && !currentUser.isLocked && (
            <PosthogIdentify userId={currentUser.id} name={currentUser.name} role={currentUser.role} />
          )}
          <Toaster position="top-center" richColors />
          {config.enableAnalytics && <Analytics />}
          <SpeedInsights />
        </LanguageProvider>
      </body>
    </html>
  )
}
