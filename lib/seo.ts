import type { Metadata } from "next"
import { cookies, headers } from "next/headers"
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, getMessages, type Locale } from "@/lib/i18n"

export const SITE_NAME = "EduPlay"

export const NOINDEX_ROBOTS: NonNullable<Metadata["robots"]> = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: {
    index: false,
    follow: false,
    noimageindex: true,
  },
}

export const INDEXABLE_ROBOTS: NonNullable<Metadata["robots"]> = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-video-preview": -1,
    "max-image-preview": "large",
    "max-snippet": -1,
  },
}

interface LocalizedSeoCopy {
  siteTitle: string
  siteDescription: string
  keywords: string[]
  ogLocale: string
  ogAlternateLocale: string
  pages: {
    home: { title: string; description: string }
    demo: { title: string; description: string }
    contact: { title: string; description: string }
    privacy: { title: string; description: string }
    terms: { title: string; description: string }
  }
}

const SEO_COPY: Record<Locale, LocalizedSeoCopy> = {
  ar: {
    siteTitle: "EduPlay — منصة ألعاب تعليمية تفاعلية بالذكاء الاصطناعي للمعلمين والطلاب",
    siteDescription:
      "أنشئ ألعاباً واختبارات تعليمية تفاعلية بالذكاء الاصطناعي في ثوانٍ مع تغذية راجعة تفسيرية، وانضمام فوري للطلاب عبر QR أو رابط بدون حسابات، وتحليلات لحظية للأداء بالعربية والإنجليزية.",
    keywords: [
      "EduPlay",
      "ألعاب تعليمية تفاعلية",
      "اختبارات تفاعلية بالذكاء الاصطناعي",
      "منصة تعليمية للمعلمين",
      "التعلم القائم على اللعب",
      "إنشاء اختبارات بالذكاء الاصطناعي",
      "مسابقات صفية مباشرة",
      "تحليلات أداء الطلاب",
      "انضمام عبر QR بدون حساب",
      "تغذية راجعة فورية",
      "AI educational games",
      "interactive classroom quiz",
    ],
    ogLocale: "ar_SA",
    ogAlternateLocale: "en_US",
    pages: {
      home: {
        title: "EduPlay — منصة ألعاب تعليمية تفاعلية بالذكاء الاصطناعي للمعلمين والطلاب",
        description:
          "منصة تعليمية تفاعلية تمكّن المعلمين والمدارس من توليد ألعاب واختبارات بالذكاء الاصطناعي (Auto AI و BYO Prompt)، وإطلاق جلسات صفية فورية عبر QR بدون حسابات للطلاب مع تحليلات لحظية.",
      },
      demo: {
        title: "تجربة اللعبة التفاعلية: مغامرة المعرفة — الصحة والوعي",
        description:
          "جرّب منصة EduPlay مباشرة كطالب في لعبة تعليمية تفاعلية قصيرة مع تغذية راجعة فورية ونصائح معرفية دون تسجيل حساب.",
      },
      contact: {
        title: "تواصل معنا",
        description:
          "تواصل مع فريق EduPlay للاستفسارات، دعم المدارس والفعاليات التعليمية، أو المساعدة في إعداد الألعاب الصفية التفاعلية.",
      },
      privacy: {
        title: "سياسة الخصوصية",
        description:
          "تعرّف على كيفية حماية EduPlay لخصوصية الطلاب دون حسابات، ومعالجة أوامر الذكاء الاصطناعي، والحذف التلقائي لبيانات الجلسات بعد 30 يوماً.",
      },
      terms: {
        title: "شروط الخدمة",
        description:
          "الشروط المنظمة لاستخدام منصة EduPlay لحسابات المعلمين، ومراجعة المحتوى المولّد بالذكاء الاصطناعي، والباقات، والملكية الفكرية.",
      },
    },
  },
  en: {
    siteTitle: "EduPlay — AI Interactive Educational Games & Classroom Quiz Platform",
    siteDescription:
      "Build interactive educational quiz games in seconds with AI (Auto AI or BYO Prompt), instant explanatory feedback, zero-account QR/PIN student join, live classroom analytics, and bilingual Arabic RTL & English LTR support.",
    keywords: [
      "EduPlay",
      "AI educational game maker",
      "interactive classroom quiz",
      "gamified learning platform",
      "AI quiz generator for teachers",
      "no account student quiz",
      "QR code classroom game",
      "formative assessment game",
      "bilingual Arabic English quiz platform",
      "real-time student analytics",
      "BYO prompt quiz JSON",
      "school quiz platform",
    ],
    ogLocale: "en_US",
    ogAlternateLocale: "ar_SA",
    pages: {
      home: {
        title: "EduPlay — AI Interactive Educational Games & Classroom Quiz Platform",
        description:
          "Create AI-powered interactive scenario quizzes in seconds, launch live classroom sessions via QR code with zero student accounts, deliver instant pedagogical feedback, and track live student comprehension.",
      },
      demo: {
        title: "Try Interactive Demo Game: Knowledge Adventure (Health & Awareness)",
        description:
          "Play an interactive EduPlay demo quiz as a student with instant explanatory feedback, learning tips, and real-time scoring — no login required.",
      },
      contact: {
        title: "Contact Us",
        description:
          "Contact the EduPlay support team for educator assistance, school onboarding, classroom events, or product feedback.",
      },
      privacy: {
        title: "Privacy Policy",
        description:
          "How EduPlay protects student anonymity with zero accounts, processes AI game-generation prompts safely, and enforces automatic 30-day session retention.",
      },
      terms: {
        title: "Terms of Service",
        description:
          "Terms governing EduPlay educator accounts, AI-generated quiz review responsibilities, fair usage quotas, and intellectual property.",
      },
    },
  },
}

/**
 * Resolves the canonical public base URL for metadata, sitemaps, robots, and JSON-LD.
 */
export function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined) ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
    "http://localhost:3000"

  const withProtocol = /^https?:\/\//i.test(raw)
    ? raw
    : raw.startsWith("localhost") || raw.startsWith("127.0.0.1")
      ? `http://${raw}`
      : `https://${raw}`

  return withProtocol.replace(/\/+$/, "")
}

/**
 * Returns the URL object expected by Next.js `metadataBase`.
 */
export function getMetadataBase(): URL {
  return new URL(getSiteUrl())
}

/**
 * Parses a candidate locale value into a supported `Locale` or `null`.
 */
export function parseSupportedLocale(value: string | string[] | undefined | null): Locale | null {
  const normalized = Array.isArray(value) ? value[0] : value
  if (normalized === "en" || normalized === "ar") {
    return normalized
  }
  return null
}

/**
 * Resolves the active SSR locale from URL override header (`x-eduplay-locale`), cookie, or default.
 */
export async function getRequestLocale(explicitLang?: string | string[] | null): Promise<{
  locale: Locale
  hasUrlLocale: boolean
}> {
  const paramLocale = parseSupportedLocale(explicitLang)
  if (paramLocale) {
    return { locale: paramLocale, hasUrlLocale: true }
  }

  const headerStore = await headers()
  const headerLocale = parseSupportedLocale(headerStore.get("x-eduplay-locale"))
  const hasHeaderLang = headerStore.get("x-eduplay-has-lang") === "1"
  if (headerLocale && hasHeaderLang) {
    return { locale: headerLocale, hasUrlLocale: true }
  }

  const cookieStore = await cookies()
  const cookieLocale = parseSupportedLocale(cookieStore.get(LOCALE_STORAGE_KEY)?.value)
  if (cookieLocale) {
    return { locale: cookieLocale, hasUrlLocale: false }
  }

  return { locale: DEFAULT_LOCALE, hasUrlLocale: false }
}

/**
 * Returns localized SEO copy bundle for a given locale.
 */
export function getSeoCopy(locale: Locale): LocalizedSeoCopy {
  return SEO_COPY[locale]
}

/**
 * Builds canonical and hreflang URLs for a public route path.
 */
export function buildPageAlternates(path: string, locale: Locale, hasUrlLocale: boolean) {
  const siteUrl = getSiteUrl()
  const baseHref = path === "/" ? `${siteUrl}/` : `${siteUrl}${path}`
  const arHref = `${baseHref}?lang=ar`
  const enHref = `${baseHref}?lang=en`
  const canonical = hasUrlLocale ? `${baseHref}?lang=${locale}` : baseHref

  return {
    canonical,
    languages: {
      ar: arHref,
      en: enHref,
      "x-default": baseHref,
    },
    types: {
      "text/markdown": `${siteUrl}/llms.txt`,
    },
  }
}

export interface BuildPublicMetadataOptions {
  page: keyof LocalizedSeoCopy["pages"]
  path: string
  locale: Locale
  hasUrlLocale: boolean
  useAbsoluteTitle?: boolean
}

/**
 * Generates full Next.js Metadata (title, description, OpenGraph, Twitter, canonical, hreflang, robots)
 * for an indexable public route.
 */
export function buildPublicMetadata({
  page,
  path,
  locale,
  hasUrlLocale,
  useAbsoluteTitle = false,
}: BuildPublicMetadataOptions): Metadata {
  const copy = getSeoCopy(locale)
  const pageCopy = copy.pages[page]
  const alternates = buildPageAlternates(path, locale, hasUrlLocale)
  const siteUrl = getSiteUrl()
  const fullTitle = useAbsoluteTitle ? pageCopy.title : `${pageCopy.title} | ${SITE_NAME}`

  return {
    title: useAbsoluteTitle ? { absolute: pageCopy.title } : pageCopy.title,
    description: pageCopy.description,
    keywords: copy.keywords,
    alternates,
    openGraph: {
      type: "website",
      locale: copy.ogLocale,
      alternateLocale: [copy.ogAlternateLocale],
      url: alternates.canonical,
      siteName: SITE_NAME,
      title: fullTitle,
      description: pageCopy.description,
      images: [
        {
          url: `${siteUrl}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: fullTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: pageCopy.description,
      images: [`${siteUrl}/twitter-image`],
    },
    robots: INDEXABLE_ROBOTS,
  }
}

/**
 * Builds root layout metadata dynamically for the resolved request locale.
 */
export function buildRootMetadata(locale: Locale): Metadata {
  const copy = getSeoCopy(locale)
  const siteUrl = getSiteUrl()

  return {
    metadataBase: getMetadataBase(),
    applicationName: SITE_NAME,
    title: {
      default: copy.siteTitle,
      template: `%s | ${SITE_NAME}`,
    },
    description: copy.siteDescription,
    keywords: copy.keywords,
    authors: [{ name: SITE_NAME, url: siteUrl }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    category: "Education",
    classification: "Educational Technology / Interactive Classroom Quiz Platform",
    icons: {
      icon: [{ url: "/icon.png", type: "image/png" }],
      apple: [{ url: "/icon.png", type: "image/png" }],
    },
    alternates: {
      types: {
        "text/markdown": `${siteUrl}/llms.txt`,
      },
    },
    openGraph: {
      type: "website",
      locale: copy.ogLocale,
      alternateLocale: [copy.ogAlternateLocale],
      url: siteUrl,
      siteName: SITE_NAME,
      title: copy.siteTitle,
      description: copy.siteDescription,
      images: [
        {
          url: `${siteUrl}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: copy.siteTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: copy.siteTitle,
      description: copy.siteDescription,
      images: [`${siteUrl}/twitter-image`],
    },
    robots: INDEXABLE_ROBOTS,
  }
}

/**
 * Builds Organization + WebSite + SoftwareApplication JSON-LD graph for the homepage.
 */
export function buildHomeJsonLd(locale: Locale, supportEmail?: string) {
  const siteUrl = getSiteUrl()
  const copy = getSeoCopy(locale)
  const faqItems = getMessages(locale).faq.items

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: SITE_NAME,
        alternateName: ["إيدوبلاي", "EduPlay Platform"],
        url: siteUrl,
        logo: {
          "@type": "ImageObject",
          url: `${siteUrl}/icon.png`,
          width: 1024,
          height: 1024,
        },
        description: copy.siteDescription,
        knowsLanguage: ["ar", "en"],
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          url: `${siteUrl}/contact`,
          ...(supportEmail ? { email: supportEmail } : {}),
          availableLanguage: ["Arabic", "English"],
        },
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: SITE_NAME,
        url: siteUrl,
        inLanguage: ["ar", "en"],
        description: copy.siteDescription,
        publisher: {
          "@id": `${siteUrl}/#organization`,
        },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${siteUrl}/#application`,
        name: SITE_NAME,
        url: siteUrl,
        applicationCategory: "EducationalApplication",
        applicationSubCategory: "AI Interactive Classroom Quiz & Game Builder",
        operatingSystem: "Web",
        browserRequirements: "Requires JavaScript. Compatible with modern desktop, tablet, and mobile browsers.",
        inLanguage: ["ar", "en"],
        isAccessibleForFree: true,
        description: copy.siteDescription,
        publisher: {
          "@id": `${siteUrl}/#organization`,
        },
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
        },
        audience: {
          "@type": "EducationalAudience",
          educationalRole: ["teacher", "student", "school administrator"],
        },
        featureList: [
          "Instant AI quiz and scenario generation (Auto AI)",
          "BYO Prompt blueprint for ChatGPT, Claude, and Gemini JSON import",
          "Zero-account student join via QR code or direct link",
          "Immediate explanatory feedback and learning tips per choice",
          "Live classroom analytics, accuracy breakdown, and celebratory podium",
          "Multi-organization school branding with custom logos and screens",
          "Full Arabic (RTL) and English (LTR) bilingual parity",
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${siteUrl}/#faq`,
        inLanguage: locale,
        mainEntity: faqItems.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
    ],
  }
}

/**
 * Builds BreadcrumbList JSON-LD for subpages.
 */
export function buildBreadcrumbJsonLd(
  items: Array<{ name: string; path: string }>,
) {
  const siteUrl = getSiteUrl()
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      item: item.path === "/" ? siteUrl : `${siteUrl}${item.path}`,
    })),
  }
}

/**
 * Builds LearningResource + Quiz JSON-LD for the public interactive demo game (/game/demo).
 */
export function buildDemoGameJsonLd(locale: Locale) {
  const siteUrl = getSiteUrl()
  const copy = getSeoCopy(locale)

  return {
    "@context": "https://schema.org",
    "@type": ["LearningResource", "Quiz"],
    name: copy.pages.demo.title,
    description: copy.pages.demo.description,
    url: `${siteUrl}/game/demo`,
    inLanguage: locale,
    isAccessibleForFree: true,
    learningResourceType: "Interactive educational quiz",
    educationalUse: "Practice and formative assessment",
    provider: {
      "@id": `${siteUrl}/#organization`,
    },
  }
}
