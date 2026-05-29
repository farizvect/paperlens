import { test, expect, type Page } from "@playwright/test";

async function dismissOnboarding(page: Page) {
  for (let i = 0; i < 6; i++) {
    const skip = page.locator("button:has-text('Skip')");
    const visible = await skip.isVisible({ timeout: 800 }).catch(() => false);
    if (!visible) break;
    await skip.click();
    await page.waitForTimeout(200);
  }
  await page.locator(".fixed.inset-0.z-\\[100\\]").waitFor({ state: "hidden", timeout: 3000 }).catch(() => {});
}

test("can upload PDF via file input", async ({ page }) => {
  await page.goto("/");
  await dismissOnboarding(page);
  await page.locator("input[type=file]").first().setInputFiles("public/test_ml.pdf");
  await expect(page.locator("text=test_ml.pdf").first()).toBeVisible({ timeout: 10000 });
});

test("upload button is visible", async ({ page }) => {
  await page.goto("/");
  await dismissOnboarding(page);
  await expect(page.locator("text=Upload PDF").first()).toBeVisible();
});
