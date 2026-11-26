import { test, expect } from "@playwright/test"

test("index sharing pills load names on click and link to teams", async ({ page }) => {
  test.setTimeout(90_000)
  for (const path of ["books", "embedders", "ai_judges", "search_endpoints"]) {
    const requests: string[] = []
    const track = (request: { url(): string }) => {
      if (request.url().includes("/relationship_items/")) requests.push(request.url())
    }
    page.on("request", track)
    await page.goto(path)
    const pill = page.locator('button[data-connection-usage-url-value$="/teams"]').first()
    await expect(pill).toBeVisible()
    expect(requests).toHaveLength(0)
    await pill.click()
    const popover = page.locator('.popover[role="dialog"]')
    const link = popover.getByRole("link").first()
    await expect(link).toHaveAttribute("href", /\/teams\/\d+$/)
    await expect(popover.locator(".popover-header")).toHaveCount(0)
    expect(requests).toHaveLength(1)
    const teamUrl = await link.getAttribute("href")
    await page.keyboard.press("Escape")
    await pill.click()
    await expect(link).toBeVisible()
    expect(requests).toHaveLength(1)
    await link.click()
    await expect(page).toHaveURL(new RegExp(`${teamUrl}$`))
    await expect(page.locator(".popover")).toHaveCount(0)
    page.off("request", track)
  }
})

test("team-table relationship pills and endpoint try pills show linked records", async ({
  page
}) => {
  test.setTimeout(90_000)
  await page.goto("teams")
  await page.locator('tbody a[href*="/teams/"]').first().click()
  const pills = page.locator('button[data-connection-usage-url-value*="/relationship_items/"]')
  await expect(pills.first()).toBeVisible()
  for (let index = 0; index < (await pills.count()); index++) {
    await pills.nth(index).click()
    const popover = page.locator('.popover[role="dialog"]')
    await expect(popover.getByRole("link").first()).toBeVisible()
    await expect(popover.getByRole("link").first()).toBeInViewport()
    await expect(popover.locator(".popover-header")).toHaveCount(0)
    await page.keyboard.press("Escape")
    await expect(popover).toBeHidden()
  }

  await page.goto("search_endpoints")
  await page.locator('button[data-connection-usage-url-value$="/tries"]').first().click()
  const tryLink = page.locator('.popover[role="dialog"]').getByRole("link").first()
  await expect(tryLink).toHaveAttribute("href", /\/case\/\d+\/try\/\d+$/)
  await expect(tryLink).toContainText(/Try \d+/)
  await page.getByRole("heading", { name: "Search Endpoints", exact: true }).click()
  await expect(page.locator(".popover")).toHaveCount(0)
})
