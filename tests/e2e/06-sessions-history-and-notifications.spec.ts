import { test, expect } from "@playwright/test";
import { createAuthenticatedContext } from "./helpers/auth";
import {
  closeTestDb,
  createClosedTestSession,
  createTestOrganization,
  createTestUser,
  deleteSystemAnnouncementsByTitle,
  deleteTestUser,
  type CreatedTestUser,
} from "./helpers/db";

test.describe("Sessions History & Admin System Notifications", () => {
  let teacherUser: CreatedTestUser;
  let adminUser: CreatedTestUser;
  let seededGameTitle: string;
  let seededPlayerName: string;
  let seededPlayId: string;
  const announcementTitle = `E2E System Notice ${Date.now()}`;

  test.beforeAll(async () => {
    teacherUser = await createTestUser({ role: "user" });
    adminUser = await createTestUser({ role: "admin" });

    const org = await createTestOrganization(teacherUser.id, "E2E History Academy");
    seededGameTitle = `جلسة تاريخية ${Date.now().toString().slice(-4)}`;
    seededPlayerName = `سارة اختبار ${Date.now().toString().slice(-4)}`;

    const seeded = await createClosedTestSession({
      ownerId: teacherUser.id,
      organizationId: org.id,
      gameTitle: seededGameTitle,
      playerName: seededPlayerName,
    });
    seededPlayId = seeded.play.id;
  });

  test.afterAll(async () => {
    await deleteSystemAnnouncementsByTitle(announcementTitle);
    await deleteTestUser(teacherUser.id);
    await deleteTestUser(adminUser.id);
    await closeTestDb();
  });

  test("teacher views closed sessions history and inspects student results details", async ({
    browser,
  }) => {
    const context = await createAuthenticatedContext(browser, teacherUser, { locale: "ar" });
    const page = await context.newPage();

    await page.goto("/dashboard/sessions");
    await expect(page.getByRole("heading", { name: seededGameTitle })).toBeVisible({
      timeout: 10_000,
    });

    const card = page
      .locator("div.rounded-2xl")
      .filter({ has: page.getByRole("heading", { name: seededGameTitle }) })
      .first();
    await card.getByRole("link", { name: /عرض التفاصيل|View Details/i }).click();

    await expect(page).toHaveURL(new RegExp(`/dashboard/sessions/${seededPlayId}$`), {
      timeout: 10_000,
    });
    await expect(page.getByText(seededPlayerName)).toBeVisible();
    await expect(page.getByText(/مكتمل|Completed/i).first()).toBeVisible();
    await expect(
      page.getByRole("link", { name: /عرض منصة التتويج|View Podium/i })
    ).toBeVisible();

    await context.close();
  });

  test("admin broadcasts announcement, teacher views & dismisses banner, admin deletes it", async ({
    browser,
  }) => {
    const adminContext = await createAuthenticatedContext(browser, adminUser, { locale: "ar" });
    const adminPage = await adminContext.newPage();

    await adminPage.goto("/admin/notifications");
    await adminPage
      .locator('input[placeholder*="تحديث جديد"], input[placeholder*="New system"]')
      .fill(announcementTitle);
    await adminPage
      .locator('textarea[placeholder*="تفاصيل الإشعار"], textarea[placeholder*="Announcement details"]')
      .fill("Automated regression check for system announcements.");
    await adminPage.getByRole("button", { name: /إرسال الإشعار العام|Broadcast Announcement/i }).click();

    await expect(adminPage.getByText(announcementTitle)).toBeVisible({ timeout: 10_000 });

    // Teacher sees announcement banner on /dashboard and dismisses it
    const teacherContext = await createAuthenticatedContext(browser, teacherUser, { locale: "ar" });
    const teacherPage = await teacherContext.newPage();

    await teacherPage.goto("/dashboard");
    await expect(teacherPage.getByRole("heading", { name: announcementTitle })).toBeVisible({
      timeout: 15_000,
    });

    await teacherPage.getByRole("button", { name: /إخفاء|Dismiss/i }).first().click();
    await expect(teacherPage.getByRole("heading", { name: announcementTitle })).toHaveCount(0, {
      timeout: 10_000,
    });
    await teacherContext.close();

    // Admin deletes the announcement cleanly
    const item = adminPage
      .locator("div.rounded-xl")
      .filter({ hasText: announcementTitle })
      .first();
    await item.locator('button[title="حذف"], button[title="Delete"]').click();
    await adminPage
      .locator("div.fixed.inset-0")
      .getByRole("button", { name: /^حذف$|^Delete$/i })
      .click();
    await expect(adminPage.getByText(announcementTitle)).toHaveCount(0, { timeout: 10_000 });

    await adminContext.close();
  });
});
