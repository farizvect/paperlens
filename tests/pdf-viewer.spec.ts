import { test, expect, type Page } from "@playwright/test";

async function dismissOverlays(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem("paperlens-onboarding-done", "1");
  });
  for (let i = 0; i < 8; i++) {
    const overlay = page.locator(".fixed.inset-0.z-\\[100\\]");
    const vis = await overlay.isVisible({ timeout: 500 }).catch(() => false);
    if (!vis) break;
    const skip = page.locator("button:has-text('Skip')");
    if (await skip.isVisible({ timeout: 300 }).catch(() => false)) {
      await skip.click();
    } else {
      await overlay.click({ position: { x: 5, y: 5 }, force: true });
    }
    await page.waitForTimeout(300);
  }
  await page.locator(".fixed.inset-0.z-\\[100\\]").waitFor({ state: "hidden", timeout: 2000 }).catch(() => {});
}

test("PDF toolbar shows zoom controls", async ({ page }) => {
  await page.goto("/");
  await dismissOverlays(page);
  await page.locator("input[type=file]").first().setInputFiles("public/test_ml.pdf");
  await expect(page.locator("text=test_ml.pdf").first()).toBeVisible({ timeout: 10000 });
  await dismissOverlays(page);
  await page.locator('button[title="Open PDF viewer"]').first().click({ timeout: 5000 });
  await page.waitForTimeout(2000);
  await expect(page.locator("text=130%").first()).toBeVisible({ timeout: 10000 });
});

test("PDF viewer virtualizes pages", async ({ page }) => {
  await page.goto("/");
  await dismissOverlays(page);
  await page.locator("input[type=file]").first().setInputFiles("public/demo.pdf");
  await expect(page.locator("text=demo.pdf").first()).toBeVisible({ timeout: 10000 });
  await dismissOverlays(page);
  await page.locator('button[title="Open PDF viewer"]').first().click({ timeout: 5000 });
  await expect(page.locator(".react-pdf__Page").first()).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1000);
  const desktopPages = await page.locator(".hidden.md\\:block .react-pdf__Page").count();
  expect(desktopPages).toBeLessThanOrEqual(5);
});
