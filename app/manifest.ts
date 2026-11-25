import type { MetadataRoute } from "next"
import { SITE_NAME } from "@/lib/seo"

/**
 * Web App Manifest for mobile home-screen installation and rich crawler metadata.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — AI Interactive Educational Games`,
    short_name: SITE_NAME,
    description:
      "AI-powered bilingual (Arabic & English) interactive educational games and live classroom quizzes with zero-account QR/PIN student access.",
    start_url: "/",
    display: "standalone",
    background_color: "#f9fafb",
    theme_color: "#059669",
    lang: "ar",
    dir: "rtl",
    categories: ["education", "productivity"],
    icons: [
      {
        src: "/icon.png",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "any",
      },
    ],
  }
}
