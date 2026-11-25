import { test, expect } from "@playwright/test";
import { createAuthenticatedContext } from "./helpers/auth";
import {
  closeTestDb,
  createTestUser,
  deleteTestUser,
  doesS3ObjectExist,
  getOrganizationsByOwner,
  type CreatedTestUser,
} from "./helpers/db";

// Valid 1x1 transparent PNG image for testing LogoUploader + Supabase S3 Storage
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

test.describe("Organizations CRUD & Supabase S3 Logo Storage", () => {
  let teacherUser: CreatedTestUser;

  test.beforeAll(async () => {
    teacherUser = await createTestUser({ role: "user" });
  });

  test.afterAll(async () => {
    await deleteTestUser(teacherUser.id);
    await closeTestDb();
  });

  test("creates organization with uploaded logo, verifies S3 object, then deletes both", async ({
    browser,
  }) => {
    const context = await createAuthenticatedContext(browser, teacherUser, { locale: "ar" });
    const page = await context.newPage();

    const uniqueOrgName = `E2E Academy ${Date.now()}`;

    await page.goto("/dashboard/organizations/new");
    await page.locator('input[name="institutionName"]').fill(uniqueOrgName);

    // Upload PNG through hidden file input inside LogoUploader
    await page.locator('input[type="file"]').setInputFiles({
      name: "test-logo.png",
      mimeType: "image/png",
      buffer: Buffer.from(TINY_PNG_BASE64, "base64"),
    });

    // Wait for browser-image-compression + FileReader preview
    await expect(page.locator('img[alt="Logo Preview"]')).toBeVisible({ timeout: 10_000 });

    // Save organization
    await page.getByRole("button", { name: /حفظ التغييرات|Save Changes/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/organizations$/, { timeout: 15_000 });
    await expect(page.getByText(uniqueOrgName)).toBeVisible();

    // Verify DB row & uploaded S3 object exist and are publicly reachable
    const orgs = await getOrganizationsByOwner(teacherUser.id);
    expect(orgs.length).toBe(1);
    const savedLogoUrl = orgs[0].logoPath;
    expect(savedLogoUrl).toBeTruthy();

    const existsBeforeDelete = await doesS3ObjectExist(savedLogoUrl!);
    expect(existsBeforeDelete).toBe(true);

    const imgResponse = await page.request.get(savedLogoUrl!);
    expect(imgResponse.ok()).toBe(true);

    // Delete the organization via UI ConfirmModal
    await page.locator('button[title="حذف"], button[title="Delete"]').first().click();
    await page.getByRole("button", { name: /نعم، احذف|Confirm|Delete/i }).click();

    await expect(page.getByText(uniqueOrgName)).toHaveCount(0, { timeout: 10_000 });

    // Verify DB row and S3 file were both removed
    const orgsAfter = await getOrganizationsByOwner(teacherUser.id);
    expect(orgsAfter.length).toBe(0);

    const existsAfterDelete = await doesS3ObjectExist(savedLogoUrl!);
    expect(existsAfterDelete).toBe(false);

    await context.close();
  });
});
