import { test, expect } from "@playwright/test";
import { createAuthenticatedContext } from "./helpers/auth";
import {
  closeTestDb,
  createPublishedTestGame,
  createTestOrganization,
  createTestUser,
  deleteTestUser,
  type CreatedTestUser,
} from "./helpers/db";

test.describe("Live Classroom Session & Real-time Student Gameplay", () => {
  let teacherUser: CreatedTestUser;
  let gameId: string;
  let playId: string;

  test.beforeAll(async () => {
    teacherUser = await createTestUser({ role: "user" });
    const org = await createTestOrganization(teacherUser.id, "E2E Live School");
    const seeded = await createPublishedTestGame({
      ownerId: teacherUser.id,
      organizationId: org.id,
    });
    gameId = seeded.game.id;
    playId = seeded.play.id;
  });

  test.afterAll(async () => {
    await deleteTestUser(teacherUser.id);
    await closeTestDb();
  });

  test("student joins and finishes game while teacher sees real-time leaderboard & podium", async ({
    browser,
  }) => {
    // 1. Authenticated Teacher opens the live session monitor
    const teacherContext = await createAuthenticatedContext(browser, teacherUser, { locale: "ar" });
    const teacherPage = await teacherContext.newPage();

    // Wait until Supabase Realtime WebSocket finishes subscribing before the student joins
    let resolveSubscribed: (() => void) | null = null;
    const realtimeReady = new Promise<void>((resolve) => {
      resolveSubscribed = resolve;
    });
    teacherPage.on("websocket", (ws) => {
      ws.on("framereceived", (frame) => {
        const text = typeof frame.payload === "string" ? frame.payload : "";
        if (text.includes("Subscribed to PostgreSQL")) {
          resolveSubscribed?.();
        }
      });
    });

    await teacherPage.goto(`/dashboard/games/${gameId}/live`);
    await expect(teacherPage.getByText(/مباشر الآن|Live Now/i)).toBeVisible({ timeout: 15_000 });
    await expect(teacherPage.getByText(/لا يوجد طلاب متصلين|No students connected/i)).toBeVisible();
    await Promise.race([realtimeReady, teacherPage.waitForTimeout(8_000)]);

    // 2. Unauthenticated Student joins in a completely separate BrowserContext
    const studentContext = await browser.newContext({ baseURL: "http://localhost:3000" });
    const studentPage = await studentContext.newPage();
    const studentName = `طالب اختبار ${Date.now().toString().slice(-4)}`;

    await studentPage.goto(`/game/${gameId}`);
    await studentPage.locator('input[type="text"]').fill(studentName);
    await studentPage.locator('form button[type="submit"]').click();

    // StartScreen -> GameplayScreen
    const startBtn = studentPage.getByRole("button", { name: /ابدأ الاختبار|Start/i });
    await expect(startBtn).toBeVisible({ timeout: 10_000 });
    await startBtn.click();

    // Select the correct answer
    await studentPage.getByRole("button", { name: /الإجابة الصحيحة E2E/ }).click();

    // Feedback overlay -> Show Results
    const resultsBtn = studentPage.getByRole("button", { name: /عرض النتيجة|Show Results/i });
    await expect(resultsBtn).toBeVisible({ timeout: 5_000 });
    await resultsBtn.click();

    await expect(studentPage.getByText("10", { exact: true })).toBeVisible();

    // 3. Verify Teacher's Live Leaderboard updates via Supabase Realtime (without manual refresh)
    await expect(teacherPage.getByRole("heading", { name: studentName })).toBeVisible({
      timeout: 15_000,
    });
    await expect(teacherPage.getByText(/أكمل الاختبار|Completed/i)).toBeVisible({ timeout: 15_000 });

    // 4. Teacher ends session -> navigates to Podium displaying the student
    await teacherPage.getByRole("button", { name: /إنهاء الجلسة|End Session/i }).click();
    await expect(teacherPage).toHaveURL(new RegExp(`/dashboard/sessions/${playId}/podium`), {
      timeout: 15_000,
    });
    await expect(teacherPage.getByText(studentName).first()).toBeVisible({ timeout: 10_000 });

    await studentContext.close();
    await teacherContext.close();
  });
});
