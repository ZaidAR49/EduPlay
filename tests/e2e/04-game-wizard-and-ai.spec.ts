import { test, expect } from "@playwright/test";
import { createAuthenticatedContext } from "./helpers/auth";
import {
  closeTestDb,
  createTestOrganization,
  createTestUser,
  deleteTestUser,
  getGamesByOwner,
  type CreatedTestUser,
} from "./helpers/db";

test.describe("Game Creation Wizard & AI Generator", () => {
  let teacherUser: CreatedTestUser;
  let orgName: string;

  test.beforeAll(async () => {
    teacherUser = await createTestUser({ role: "user" });
    const org = await createTestOrganization(teacherUser.id, `E2E School ${Date.now()}`);
    orgName = org.name;
  });

  test.afterAll(async () => {
    await deleteTestUser(teacherUser.id);
    await closeTestDb();
  });

  test("creates, publishes, and edits a game via the manual GameWizard", async ({ browser }) => {
    const context = await createAuthenticatedContext(browser, teacherUser, { locale: "ar" });
    const page = await context.newPage();

    const uniqueSuffix = Date.now().toString();
    const initialTitle = `E2E Quiz ${uniqueSuffix}`;
    const updatedTitle = `E2E Quiz Updated ${uniqueSuffix}`;
    const slug = `e2e-quiz-${uniqueSuffix}`;

    await page.goto("/dashboard/games/new");
    await page.getByRole("button", { name: /البناء اليدوي|Manual/i }).click();

    // Step 1: Basic Information
    await page.locator('input[name="title"]').fill(initialTitle);
    await page.locator('input[name="slug"]').fill(slug);
    await page.locator('textarea[name="description"]').fill("Automated E2E game description");
    const orgSelect = page.locator('select[name="organizationId"]');
    await expect(orgSelect).toContainText(orgName);
    await orgSelect.selectOption({ label: orgName });

    await page.getByRole("button", { name: /التالي|Next/i }).click();

    // Step 2: Scenarios & Choices (choices have valid defaults; fill scenario description)
    const scenarioDescTextarea = page.locator("div.lg\\:col-span-8 textarea").first();
    await expect(scenarioDescTextarea).toBeVisible();
    await scenarioDescTextarea.fill("ما هو الكوكب الأقرب إلى الشمس؟");

    await page.getByRole("button", { name: /التالي|Next/i }).click();

    // Step 3: Publish & Save
    await page.locator('input[name="status"][value="published"]').locator("..").click();
    await page.getByRole("button", { name: /حفظ اللعبة وإنهاء|Save Game & Finish/i }).click();

    // Success modal displays QR code and link back to dashboard
    await expect(page.locator("#qr-code-canvas")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("link", { name: /العودة للوحة التحكم|Back to Dashboard/i }).click();

    await expect(page).toHaveURL(/\/dashboard\/games$/);
    await expect(page.getByText(initialTitle)).toBeVisible();

    // Verify persisted in DB and edit the game
    const games = await getGamesByOwner(teacherUser.id);
    expect(games.length).toBe(1);
    expect(games[0].status).toBe("published");

    await page.goto(`/dashboard/games/${games[0].id}/edit`);
    await page.locator('input[name="title"]').fill(updatedTitle);
    await page.getByRole("button", { name: /التالي|Next/i }).click();
    await page.getByRole("button", { name: /التالي|Next/i }).click();
    await page.getByRole("button", { name: /حفظ اللعبة وإنهاء|Save Game & Finish/i }).click();

    await expect(page.locator("#qr-code-canvas")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("link", { name: /العودة للوحة التحكم|Back to Dashboard/i }).click();
    await expect(page.getByText(updatedTitle)).toBeVisible();

    await context.close();
  });

  test("Auto AI Wizard parses mocked /api/generate stream into GameWizard", async ({ browser }) => {
    const context = await createAuthenticatedContext(browser, teacherUser, { locale: "ar" });
    const page = await context.newPage();

    const mockedAiTitle = "لعبة العلوم المولدة آلياً";
    const mockedPayload =
      JSON.stringify({
        title: mockedAiTitle,
        description: "وصف مولد لاختبار التدفق الآلي",
        slug: `ai-science-${Date.now()}`,
        icon: "🔬",
        scenarios: [
          {
            title: "دورة الماء",
            description: "ماذا يحدث للماء عند تسخينه؟",
            icon: "💧",
            choices: [
              {
                text: "يتبخر",
                icon: "☁️",
                isCorrect: true,
                points: 10,
                feedback: {
                  title: "ممتاز!",
                  message: "التبخر يحول السائل إلى بخار.",
                  tip: "الحرارة تسرع حركة الجزيئات.",
                },
              },
              {
                text: "يتجمد",
                icon: "🧊",
                isCorrect: false,
                points: 0,
                feedback: {
                  title: "غير صحيح",
                  message: "التجمد يحدث بالتبريد.",
                  tip: "راجع حالات المادة.",
                },
              },
            ],
          },
        ],
      }) + '\n<!--AI_META:{"tokensUsed":123}-->';

    await page.route("**/api/generate", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/plain; charset=utf-8",
        body: mockedPayload,
      });
    });

    await page.goto("/dashboard/games/new");
    await page.getByRole("button", { name: /التوليد الفوري|Auto AI/i }).click();

    await page.locator("textarea").first().fill("دورة الماء في الطبيعة");
    await page.getByRole("button", { name: /توليد اللعبة الآن|Generate/i }).click();

    // AutoAiWizard transitions into GameWizard with pre-populated title & token badge
    await expect(page.locator('input[name="title"]')).toHaveValue(mockedAiTitle, {
      timeout: 10_000,
    });
    await expect(page.getByText(/123/)).toBeVisible();

    await context.close();
  });
});
