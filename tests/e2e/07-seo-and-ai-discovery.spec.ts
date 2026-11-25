import { test, expect } from "@playwright/test"

test.describe("SEO, Bilingual Indexing & AI Search Discovery", () => {
  test("robots.txt allows public & AI crawlers while blocking private routes", async ({ request }) => {
    const res = await request.get("/robots.txt")
    expect(res.status()).toBe(200)
    const body = await res.text()

    expect(body).toContain("User-Agent: *")
    expect(body).toContain("OAI-SearchBot")
    expect(body).toContain("GPTBot")
    expect(body).toContain("PerplexityBot")
    expect(body).toContain("ClaudeBot")
    expect(body).toContain("Google-Extended")
    expect(body).toContain("Allow: /game/demo")
    expect(body).toContain("Allow: /llms.txt")
    expect(body).toContain("Disallow: /admin")
    expect(body).toContain("Disallow: /dashboard")
    expect(body).toContain("Disallow: /login")
    expect(body).toContain("Sitemap:")
  })

  test("sitemap.xml lists bilingual public pages and demo route with hreflang alternates", async ({ request }) => {
    const res = await request.get("/sitemap.xml")
    expect(res.status()).toBe(200)
    const xml = await res.text()

    expect(xml).toContain("<urlset")
    expect(xml).toContain("/game/demo")
    expect(xml).toContain("/contact")
    expect(xml).toContain("/privacy")
    expect(xml).toContain("/terms")
    expect(xml).toContain("?lang=en")
    expect(xml).toContain('hreflang="ar"')
    expect(xml).toContain('hreflang="en"')
    expect(xml).toContain('hreflang="x-default"')
  })

  test("llms.txt and llms-full.txt serve clean markdown AI documentation", async ({ request }) => {
    const llmsRes = await request.get("/llms.txt")
    expect(llmsRes.status()).toBe(200)
    expect(llmsRes.headers()["content-type"]).toContain("text/markdown")
    const llmsBody = await llmsRes.text()
    expect(llmsBody).toContain("# EduPlay")
    expect(llmsBody).toContain("/game/demo")
    expect(llmsBody).toContain("/llms-full.txt")

    const fullRes = await request.get("/llms-full.txt")
    expect(fullRes.status()).toBe(200)
    expect(fullRes.headers()["content-type"]).toContain("text/markdown")
    const fullBody = await fullRes.text()
    expect(fullBody).toContain("Auto AI Generator")
    expect(fullBody).toContain("BYO Prompt Engine")
    expect(fullBody).toContain("30 days")
  })

  test("manifest.webmanifest and OpenGraph/Twitter images respond cleanly", async ({ request }) => {
    const manifestRes = await request.get("/manifest.webmanifest")
    expect(manifestRes.status()).toBe(200)
    const manifest = await manifestRes.json()
    expect(manifest.short_name).toBe("EduPlay")
    expect(manifest.start_url).toBe("/")

    const ogRes = await request.get("/opengraph-image")
    expect(ogRes.status()).toBe(200)
    expect(ogRes.headers()["content-type"]).toContain("image/png")

    const twitterRes = await request.get("/twitter-image")
    expect(twitterRes.status()).toBe(200)
    expect(twitterRes.headers()["content-type"]).toContain("image/png")
  })

  test("homepage serves rich Arabic default and English ?lang=en SSR HTML, metadata, hreflang, and JSON-LD", async ({ page, request }) => {
    // Default Arabic SSR
    const arHtml = await (await request.get("/")).text()
    expect(arHtml).toContain('<html lang="ar" dir="rtl"')
    expect(arHtml).toContain('type="application/ld+json"')
    expect(arHtml).toContain('"@type":"SoftwareApplication"')
    expect(arHtml).toContain('"@type":"FAQPage"')
    expect(arHtml).toContain('rel="alternate" type="text/markdown"')
    expect(arHtml).toContain("/llms.txt")

    // English ?lang=en SSR
    await page.goto("/?lang=en")
    await expect(page.locator("html")).toHaveAttribute("lang", "en")
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr")
    await expect(page).toHaveTitle(/EduPlay.*AI Interactive Educational Games/i)
    await expect(page.locator("#faq")).toContainText("What is EduPlay and who is it built for?")
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\?lang=en$/)
    await expect(page.locator('link[rel="alternate"][hreflang="ar"]')).toHaveAttribute("href", /\?lang=ar$/)
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", /\?lang=en$/)
  })

  test("public subpages have unique titles, /policies issues HTTP 308, and private/auth routes emit noindex", async ({ page, request }) => {
    const policiesRes = await request.get("/policies", { maxRedirects: 0 })
    expect(policiesRes.status()).toBe(308)
    expect(policiesRes.headers()["location"]).toContain("/privacy")

    await page.goto("/contact?lang=en")
    await expect(page).toHaveTitle(/Contact Us \| EduPlay/)

    await page.goto("/game/demo?lang=en")
    await expect(page).toHaveTitle(/Knowledge Adventure.*EduPlay/)
    const demoJsonLd = await page.locator('script[type="application/ld+json"]').textContent()
    expect(demoJsonLd).toContain("LearningResource")

    // Non-indexable auth/error routes
    const loginRes = await request.get("/login")
    expect(loginRes.headers()["x-robots-tag"]).toContain("noindex")
    await page.goto("/login")
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/i)

    const unauthRes = await request.get("/unauthorized")
    expect(unauthRes.headers()["x-robots-tag"]).toContain("noindex")
  })
})
