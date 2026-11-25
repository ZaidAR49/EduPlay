import { test, expect } from "@playwright/test";

test.describe("Public Pages, Localization (RTL/LTR) & Demo Game", () => {
  test("home page loads and switches between Arabic (RTL) and English (LTR)", async ({ page }) => {
    await page.goto("/");

    // Default locale is Arabic (RTL)
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("link", { name: "جرب اللعبة", exact: true })).toBeVisible();

    // Switch to English via LanguageDropdown
    await page.getByRole("button", { name: "Select Language" }).click();
    await page.getByRole("button", { name: "English" }).click();

    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByRole("link", { name: "Try the Game", exact: true })).toBeVisible();

    // Switch back to Arabic
    await page.getByRole("button", { name: "Select Language" }).click();
    await page.getByRole("button", { name: "عربي" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });

  test("policies and contact pages load and contact submission succeeds", async ({ page }) => {
    await page.goto("/policies");
    await expect(page.locator("main, body")).toContainText(/الخصوصية|Privacy|الشروط|Terms/i);

    // Mock /api/contact so CI tests don't send real SMTP/Resend emails
    await page.route("**/api/contact", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, message: "تم إرسال الرسالة بنجاح" }),
      });
    });

    await page.goto("/contact");
    await page.fill("#name", "Playwright Tester");
    await page.fill("#email", "tester@example.com");
    await page.fill("#subject", "Regression Check");
    await page.fill("#message", "Automated verification of the contact form.");
    await page.locator('form button[type="submit"]').click();

    await expect(page.getByRole("button", { name: /إرسال رسالة أخرى|Send Another/i })).toBeVisible();
  });

  test("demo game plays through start, scenarios, feedback, and result screen", async ({ page }) => {
    await page.goto("/game/demo");

    // StartScreen
    const startButton = page.getByRole("button", { name: /ابدأ الاختبار|Start/i });
    await expect(startButton).toBeVisible();
    await startButton.click();

    // DEMO_GAME has 3 scenarios in data/demo-game.ts
    for (let i = 0; i < 3; i++) {
      // Pick the first answer choice button inside the choices list
      const choices = page.locator("div.space-y-3 > button");
      await expect(choices.first()).toBeVisible();
      await choices.first().click();

      // Feedback overlay appears after config.game.feedbackDelayMs (800ms)
      const nextOrResultsBtn = page.getByRole("button", {
        name: /التالي|عرض النتيجة|Next|Show Results/i,
      });
      await expect(nextOrResultsBtn).toBeVisible({ timeout: 5_000 });
      await nextOrResultsBtn.click();
    }

    // ResultScreen renders with score & retry button
    await expect(page.getByText(/إعادة المحاولة|Try Again|نتيجتك النهائية|Final Score/i).first()).toBeVisible();
  });
});
