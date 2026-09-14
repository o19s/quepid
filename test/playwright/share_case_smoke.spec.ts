/**
 * One-off smoke: share-case on core case page (API stay-on-page).
 * Run inside devcontainer with app on 127.0.0.1:3000.
 */
import { test, expect } from "@playwright/test"

const CASE_ID = Number(process.env.QUEPID_E2E_CASE_ID || 1)

test("share-case smoke: share then unshare updates toolbar teams", async ({ page }) => {
  await page.goto(`case/${CASE_ID}`)
  await page.waitForSelector("#case-actions", { timeout: 20_000 })

  await page.getByText("Share case", { exact: true }).click()
  const modal = page.locator("#shareCaseModal.show, .modal.show").first()
  await expect(modal).toBeVisible()
  await expect(modal.locator("[data-share-case-core-target='loading']")).toBeHidden({ timeout: 15_000 })

  const shareable = modal.locator("#share-case-shareable-list [data-team-id]")
  const shared = modal.locator("#share-case-shared-list [data-team-id]")

  if ((await shareable.count()) > 0) {
    const teamId = await shareable.first().getAttribute("data-team-id")
    const teamName = await shareable.first().textContent()
    await shareable.first().click()
    await expect(modal.locator("#share-case-submit")).toBeVisible()
    await modal.locator("#share-case-submit").click()
    await expect(modal.locator(".alert-success")).toContainText("shared", { timeout: 10_000 })
    await expect(modal.locator("#share-case-shared-list [data-team-id='" + teamId + "']")).toBeVisible()

    await shared.filter({ hasText: teamName?.trim() || "" }).first().click()
    await expect(modal.locator("#unshare-case-submit")).toBeVisible()
    await modal.locator("#unshare-case-submit").click()
    await expect(modal.locator(".alert-success")).toContainText("unshared", { timeout: 10_000 })
  } else {
    test.skip(true, "No unshared teams available for share-case smoke")
  }

  await modal.getByRole("button", { name: "Cancel" }).click()
  await expect(modal).toBeHidden({ timeout: 5_000 })
})
