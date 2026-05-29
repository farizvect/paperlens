import { test, expect, type Page } from "@playwright/test";

async function dismissOverlays(page: Page) {
  // Set localStorage to skip onboarding
  await page.evaluate(() => {
    localStorage.setItem("paperlens-onboarding-done", "1");
  });
  // Dismiss any currently visible overlay
  for (let i = 0; i < 8; i++) {
    const overlay = page.locator(".fixed.inset-0.z-\\[100\\]");
    const vis = await overlay.isVisible({ timeout: 500 }).catch(() => false);
    if (!vis) break;
    // Try clicking Skip first
    const skip = page.locator("button:has-text('Skip')");
    if (await skip.isVisible({ timeout: 300 }).catch(() => false)) {
      await skip.click();
    } else {
      // Click backdrop
      await overlay.click({ position: { x: 5, y: 5 }, force: true });
    }
    await page.waitForTimeout(300);
  }
  // Ensure overlay is gone
  await page.locator(".fixed.inset-0.z-\\[100\\]").waitFor({ state: "hidden", timeout: 2000 }).catch(() => {});
}

test("sidebar is visible on desktop", async ({ page }) => {
  await page.goto("/");
  await dismissOverlays(page);
  await expect(page.locator("h1:has-text('PaperLens')")).toBeVisible();
});

test("no right-side gap when PDF viewer is open", async ({ page }) => {
  await page.goto("/");
  await dismissOverlays(page);
  await page.locator("input[type=file]").first().setInputFiles("public/test_ml.pdf");
  await expect(page.locator("text=test_ml.pdf").first()).toBeVisible({ timeout: 10000 });
  // Dismiss overlays again (upload may trigger onboarding re-check)
  await dismissOverlays(page);
  await page.locator('button[title="Open PDF viewer"]').first().click({ timeout: 5000 });
  await page.waitForTimeout(1000);
  const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
});

test("split gutter exists when viewer is open", async ({ page }) => {
  await page.goto("/");
  await dismissOverlays(page);
  await page.locator("input[type=file]").first().setInputFiles("public/test_ml.pdf");
  await expect(page.locator("text=test_ml.pdf").first()).toBeVisible({ timeout: 10000 });
  await dismissOverlays(page);
  await page.locator('button[title="Open PDF viewer"]').first().click({ timeout: 5000 });
  await page.waitForTimeout(1500);
  const gutter = page.locator('div[style*="touch-action: none"]').first();
  await expect(gutter).toBeVisible({ timeout: 5000 });
  const box = await gutter.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(7);
  expect(box?.width).toBeLessThanOrEqual(9);
});
