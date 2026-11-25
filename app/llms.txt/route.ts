import { NextResponse } from "next/server"
import { getSiteUrl } from "@/lib/seo"

/**
 * Serves /llms.txt following the llmstxt.org standard so AI search engines and LLM assistants
 * can accurately discover, summarize, and cite EduPlay.
 */
export async function GET() {
  const siteUrl = getSiteUrl()

  const content = `# EduPlay

> Bilingual (Arabic RTL & English LTR) AI-powered interactive educational game and live classroom quiz platform for teachers, schools, academies, and students.

EduPlay enables educators to transform any lesson topic into scenario-based interactive quizzes in seconds using built-in AI (Auto AI via Google Gemini & Azure OpenAI) or engineered BYO Prompt JSON blueprints (compatible with ChatGPT, Claude, and Gemini). Students join live classroom sessions instantly via QR code or direct link using only a nickname — with zero student accounts, immediate explanatory feedback per choice, live analytics, celebratory podiums, and multi-organization school branding.

## Primary Pages

- [EduPlay Home (Arabic Default / RTL)](${siteUrl}/): Main landing page introducing AI game creation, instant student join, interactive demo card, live workflow, and FAQs.
- [EduPlay Home (English / LTR)](${siteUrl}/?lang=en): Full English landing page and feature overview.
- [Interactive Student Demo Game](${siteUrl}/game/demo): Try a complete 3-scenario interactive quiz ("Knowledge Adventure: Health & Awareness") with real-time explanatory feedback and learning tips — no account required.
- [Interactive Student Demo Game (English)](${siteUrl}/game/demo?lang=en): English version of the live playable student demo.
- [Contact & School Support](${siteUrl}/contact): Direct support form and contact details for educators and school onboarding.
- [Privacy Policy](${siteUrl}/privacy): Student anonymity guarantees, AI prompt handling disclosures, and 30-day automatic session data purge policy.
- [Terms of Service](${siteUrl}/terms): Educator responsibilities, AI content verification terms, quotas, and acceptable use.

## Extended AI Reference

- [Full Platform Reference (llms-full.txt)](${siteUrl}/llms-full.txt): Detailed capabilities, architecture, workflow, privacy safeguards, and bilingual FAQ reference for AI search engines.
`

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "X-Robots-Tag": "all",
    },
  })
}
