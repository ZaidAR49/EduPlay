import { test, expect } from "@playwright/test";
import { createAuthenticatedContext } from "./helpers/auth";
import { closeTestDb, createTestUser, deleteTestUser, type CreatedTestUser } from "./helpers/db";

test.describe("Authentication & Role-Based Access Control (RBAC)", () => {
  const createdUsers: CreatedTestUser[] = [];
  let teacherUser: CreatedTestUser;
  let lockedUser: CreatedTestUser;
  let viewerUser: CreatedTestUser;
  let adminUser: CreatedTestUser;

  test.beforeAll(async () => {
    teacherUser = await createTestUser({ role: "user" });
    lockedUser = await createTestUser({ role: "user", isLocked: true });
    viewerUser = await createTestUser({ role: "viewer" });
    adminUser = await createTestUser({ role: "admin" });
    createdUsers.push(teacherUser, lockedUser, viewerUser, adminUser);
  });

  test.afterAll(async () => {
    for (const u of createdUsers) {
      await deleteTestUser(u.id);
    }
    await closeTestDb();
  });

  test("unauthenticated visitors are redirected away from protected routes", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/(login|api\/auth\/signin)/);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/(login|api\/auth\/signin)/);
  });

  test("locked user is redirected to /blocked", async ({ browser }) => {
    const context = await createAuthenticatedContext(browser, lockedUser);
    const page = await context.newPage();

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/blocked/);
    await expect(page.getByText(/تم حظر حسابك|blocked/i)).toBeVisible();

    await context.close();
  });

  test("teacher (role: user) accesses /dashboard but is denied /admin", async ({ browser }) => {
    const context = await createAuthenticatedContext(browser, teacherUser);
    const page = await context.newPage();

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/unauthorized/);

    await context.close();
  });

  test("viewer is routed to /admin/analytics and blocked from /admin/settings", async ({ browser }) => {
    const context = await createAuthenticatedContext(browser, viewerUser);
    const page = await context.newPage();

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/analytics/);

    // Viewer lacks "staff:read" permission
    await page.goto("/admin/settings");
    await expect(page).toHaveURL(/\/unauthorized/);

    await context.close();
  });

  test("admin accesses /admin/accounts and /admin/settings", async ({ browser }) => {
    const context = await createAuthenticatedContext(browser, adminUser);
    const page = await context.newPage();

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/accounts/);

    await page.goto("/admin/settings");
    await expect(page).toHaveURL(/\/admin\/settings/);
    await expect(page.getByText(adminUser.email)).toBeVisible();

    await context.close();
  });
});
