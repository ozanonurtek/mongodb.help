import { test, expect } from "@playwright/test";

const INPUT_RE = /error|question|slow query|hatanızı|sorgunuzu/i;

test.describe("mongodb.help chat", () => {
  test("loads the chat UI in English", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "mongodb.help" })).toBeVisible();
    await expect(page.getByPlaceholder(INPUT_RE)).toBeVisible();
    await expect(page.getByRole("button", { name: "Send" })).toBeVisible();
  });

  test("switches language to Turkish via path prefix", async ({ page }) => {
    await page.goto("/tr");
    await expect(page.getByRole("link", { name: "mongodb.help" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Gönder" })).toBeVisible();
  });

  test("sends a message and renders a grounded assistant reply with real citations", async ({
    page,
  }) => {
    await page.goto("/");
    const input = page.getByPlaceholder(INPUT_RE);
    await input.fill("MongoServerError: connection timed out");
    await page.getByRole("button", { name: "Send" }).click();

    // An assistant section appears (Knowledge Service prose, grounded + cited).
    await expect(
      page.locator("div.bg-secondary, [class*='bg-secondary']").first(),
    ).toBeVisible({ timeout: 30000 });

    // Real citation link to MongoDB docs / learn.
    await expect(
      page.locator("a[href*='mongodb.com']").first(),
    ).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("button", { name: "Helpful" }).first()).toBeVisible();
  });

  test("per-chat message limit is enforced (read from /api/config)", async ({ page }) => {
    const cfg = await page.request.get(`${process.env.BASE_URL || ""}/api/config`);
    const { anonMessagesPerChat } = await cfg.json();

    await page.goto("/");
    const input = page.getByPlaceholder(INPUT_RE);

    for (let i = 0; i < anonMessagesPerChat; i++) {
      await input.fill(`question ${i}`);
      await page.getByRole("button", { name: "Send" }).click();
      await expect(
        page.locator("a[href*='mongodb.com']").nth(0),
      ).toBeVisible({ timeout: 30000 });
    }

    await input.fill("one too many");
    await page.getByRole("button", { name: "Send" }).click();
    // Anonymous users hitting the per-chat limit get a sign-up prompt (lead
    // capture), not a bare error banner.
    await expect(page.getByText(/hit the free limit/i)).toBeVisible({ timeout: 15000 });
  });

  test("feedback buttons submit without error", async ({ page }) => {
    await page.goto("/");
    const input = page.getByPlaceholder(INPUT_RE);
    await input.fill("why is my aggregation slow?");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(
      page.locator("a[href*='mongodb.com']").first(),
    ).toBeVisible({ timeout: 30000 });
    await page.getByRole("button", { name: "Helpful" }).first().click();
  });

  test("legal disclaimer page is reachable", async ({ page }) => {
    await page.goto("/legal/disclaimer");
    await expect(page.getByRole("heading", { name: "Disclaimer" })).toBeVisible();
  });
});
