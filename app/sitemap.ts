import type { MetadataRoute } from "next"
import { getSiteUrl } from "@/lib/seo"

interface SitemapRouteConfig {
  path: string
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]
  priorityAr: number
  priorityEn: number
}

const PUBLIC_ROUTES: SitemapRouteConfig[] = [
  { path: "/", changeFrequency: "weekly", priorityAr: 1.0, priorityEn: 0.95 },
  { path: "/game/demo", changeFrequency: "monthly", priorityAr: 0.9, priorityEn: 0.85 },
  { path: "/contact", changeFrequency: "monthly", priorityAr: 0.8, priorityEn: 0.75 },
  { path: "/privacy", changeFrequency: "monthly", priorityAr: 0.5, priorityEn: 0.5 },
  { path: "/terms", changeFrequency: "monthly", priorityAr: 0.5, priorityEn: 0.5 },
]

/**
 * Generates a bilingual XML sitemap with hreflang alternates (`ar`, `en`, `x-default`)
 * for all public EduPlay landing, demo, contact, and legal routes.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl()
  const lastModified = new Date("2026-11-25T00:00:00.000Z")
  const ogImage = `${siteUrl}/opengraph-image`

  return PUBLIC_ROUTES.flatMap((route) => {
    const defaultUrl = route.path === "/" ? `${siteUrl}/` : `${siteUrl}${route.path}`
    const arUrl = `${defaultUrl}?lang=ar`
    const enUrl = `${defaultUrl}?lang=en`

    const alternates = {
      languages: {
        ar: arUrl,
        en: enUrl,
        "x-default": defaultUrl,
      },
    }

    return [
      {
        url: defaultUrl,
        lastModified,
        changeFrequency: route.changeFrequency,
        priority: route.priorityAr,
        alternates,
        images: [ogImage],
      },
      {
        url: enUrl,
        lastModified,
        changeFrequency: route.changeFrequency,
        priority: route.priorityEn,
        alternates,
        images: [ogImage],
      },
    ]
  })
}
