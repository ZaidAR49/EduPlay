import type { MetadataRoute } from "next"
import { getSiteUrl } from "@/lib/seo"

const PUBLIC_ALLOW = [
  "/",
  "/game/demo",
  "/contact",
  "/privacy",
  "/terms",
  "/policies",
  "/llms.txt",
  "/llms-full.txt",
]

const PRIVATE_DISALLOW = [
  "/admin",
  "/admin/",
  "/dashboard",
  "/dashboard/",
  "/api",
  "/api/",
  "/login",
  "/login/",
  "/auth-error",
  "/blocked",
  "/unauthorized",
  "/game/",
]

/**
 * Generates robots.txt explicitly welcoming search engines and AI search crawlers
 * to public pages and LLM knowledge files while blocking private/live routes.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl()

  const searchAndAiAgents = [
    "Googlebot",
    "Google-Extended",
    "bingbot",
    "OAI-SearchBot",
    "GPTBot",
    "ChatGPT-User",
    "PerplexityBot",
    "ClaudeBot",
    "anthropic-ai",
    "Applebot-Extended",
    "meta-externalagent",
  ]

  return {
    rules: [
      {
        userAgent: "*",
        allow: PUBLIC_ALLOW,
        disallow: PRIVATE_DISALLOW,
      },
      ...searchAndAiAgents.map((userAgent) => ({
        userAgent,
        allow: PUBLIC_ALLOW,
        disallow: PRIVATE_DISALLOW,
      })),
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}
