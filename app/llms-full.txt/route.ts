import { NextResponse } from "next/server"
import { getPublicSupportEmail } from "@/lib/emails/email-config"
import { getSiteUrl } from "@/lib/seo"
import { getMessages } from "@/lib/i18n"

/**
 * Serves /llms-full.txt with comprehensive, factual product documentation and bilingual FAQs
 * for AI search engines, retrieval systems, and LLM answer engines.
 */
export async function GET() {
  const siteUrl = getSiteUrl()
  const supportEmail = getPublicSupportEmail()
  const enFaq = getMessages("en").faq.items
  const arFaq = getMessages("ar").faq.items

  const content = `# EduPlay — Complete Platform Reference for AI Search & Assistants

Canonical URL: ${siteUrl}
Supported Languages: Arabic (ar, RTL) and English (en, LTR)
Category: Educational Technology (EdTech) / Interactive Classroom Quiz & AI Game Builder
Target Audience: K-12 teachers, university instructors, schools, tutoring centers, training organizations, and students
Pricing Model: Free tier (100,000 AI tokens/month) and Pro tier (1,000,000 AI tokens/month)
${supportEmail ? `Support Email: ${supportEmail}\n` : ""}
## 1. What EduPlay Solves

Teachers often spend hours writing engaging multiple-choice questions, plausible distractors, and clear explanations — and traditional classroom quiz tools either require student accounts or only mark answers "right/wrong" without explaining why.

EduPlay solves both problems:
1. Educators generate complete, pedagogically structured scenario games in seconds using AI or custom prompt blueprints.
2. Every answer choice delivers immediate explanatory feedback explaining *why* an option is correct or incorrect, plus an enrichment learning tip.
3. Students join live classroom sessions in under 2 seconds by scanning a QR code or opening a session link with a nickname — no email, password, or account registration required.

## 2. Core Capabilities

### AI-Powered Quiz & Game Creation
- **Auto AI Generator**: Enter any lesson topic (e.g., "Food Chain in the Ecosystem", "Photosynthesis", "World History") and question count. EduPlay's 3-tier AI gateway (supporting Microsoft Azure OpenAI, Google AI Studio / Gemini, and Google Vertex AI with JSON self-repair) creates scenarios, 4 balanced choices per question, explanatory feedback, and learning tips in Arabic or English.
- **BYO Prompt Engine (Bring Your Own Prompt)**: Copy a precision-engineered JSON Prompt Blueprint customized for your topic, question count, and language, run it in external LLMs such as ChatGPT, Claude, or Gemini, and paste the JSON output into EduPlay to validate and convert it into a ready-to-play game.
- **Interactive Manual Wizard**: Step-by-step editor with drag-and-drop scenario reordering, custom scoring, and direct draft/publish controls.

### Classroom Gameplay & Student Experience
- **Zero-Account Student Join**: Students scan a QR code or open the session URL, pick a fun bilingual nickname (or auto-generate one), and start playing immediately.
- **Offline Progress Resilience**: Student answers and progress are cached in browser storage and synced automatically during temporary network drops.
- **Pedagogical Feedback & Tips**: Instant per-choice explanation and memory tip after each question.
- **Celebratory Podium**: Real-time top-3 animated podium with confetti effects and full-screen presentation mode.

### Real-Time Teacher & Organization Tools
- **Live Host Dashboard**: Real-time connected student count, live score leaderboard, question accuracy breakdown, and completion rates.
- **Multi-Tenant Organizations**: Teachers can organize games and sessions under distinct schools, academies, or departments, complete with compressed WebP school logos and customized intro/result screens.
- **Historical Session Reports**: Review completed classroom sessions and student scores.

### Full Bilingual Parity (Arabic RTL & English LTR)
- 100% localized UI, demo experiences, AI prompt generation, and student nicknames in both **Arabic (العربية — RTL)** and **English (LTR)**.
- Explicit URL language variants available via \`?lang=ar\` and \`?lang=en\` (default: Arabic RTL).

## 3. Privacy, Security & Data Retention Facts

- **Student Anonymity**: Students never provide emails, passwords, phone numbers, or personal profiles. An HttpOnly gameplay cookie (\`eduplay_student_id\`) prevents score tampering during a live session.
- **Educator Authentication**: Teachers sign in via Google OAuth (Auth.js v5); EduPlay never accesses Gmail, Contacts, or Google Drive.
- **AI Privacy**: Built-in AI only receives the lesson topic, question count, language, or organization copy requested by the teacher — zero student personal data is sent to AI models.
- **Automatic Session Expiry & Data Purge**: Live classroom sessions automatically close after 2 hours, and detailed student session responses and scores are permanently purged after 30 days.

## 4. Public URLs

- Homepage (Arabic RTL default): ${siteUrl}/
- Homepage (English LTR): ${siteUrl}/?lang=en
- Live Playable Student Demo (Arabic): ${siteUrl}/game/demo
- Live Playable Student Demo (English): ${siteUrl}/game/demo?lang=en
- Contact & School Support: ${siteUrl}/contact
- Privacy Policy: ${siteUrl}/privacy
- Terms of Service: ${siteUrl}/terms
- Sitemap: ${siteUrl}/sitemap.xml

## 5. Frequently Asked Questions (English)

${enFaq.map((item) => `### ${item.question}\n${item.answer}\n`).join("\n")}
## 6. الأسئلة الشائعة (Arabic)

${arFaq.map((item) => `### ${item.question}\n${item.answer}\n`).join("\n")}
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
