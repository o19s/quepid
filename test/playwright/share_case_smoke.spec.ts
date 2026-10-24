/**
 * One-off smoke: share-case on core case page (API stay-on-page).
 * Run inside devcontainer with app on 127.0.0.1:3000.
 */
import { test, expect } from "@playwright/test"
import { createTeamViaApi, deleteTeamViaApi } from "./case_helpers"

const CASE_ID = Number(process.env.QUEPID_E2E_CASE_ID || 1)

test("share-case smoke: share then unshare updates toolbar teams", async ({ page }) => {
  // Its own team, so the smoke never depends on (or skips for lack of) teams already in the dev DB.
  await page.goto("cases")
  const teamId = await createTeamViaApi(page, `Playwright Smoke Team ${Date.now()}`)
  try {
    await shareThenUnshare(page, teamId)
  } finally {
    await deleteTeamViaApi(page, teamId)
  }
})

async function shareThenUnshare(page: import("@playwright/test").Page, teamId: number) {
  await page.goto(`case/${CASE_ID}`)
  await page.waitForSelector("#case-actions", { timeout: 20_000 })

  await page.getByText("Share case", { exact: true }).click()
  const modal = page.locator("#shareCaseModal.show, .modal.show").first()
  await expect(modal).toBeVisible()
  await expect(modal.locator("[data-share-case-core-target='loading']")).toBeHidden({ timeout: 15_000 })

  const shareable = modal.locator(`#share-case-shareable-list [data-team-id='${teamId}']`)
  const shared = modal.locator(`#share-case-shared-list [data-team-id='${teamId}']`)

  await shareable.click()
  await expect(modal.locator("#share-case-submit")).toBeVisible()
  await modal.locator("#share-case-submit").click()
  await expect(modal.locator(".alert-success")).toContainText("shared", { timeout: 10_000 })
  await expect(shared).toBeVisible()

  await shared.click()
  await expect(modal.locator("#unshare-case-submit")).toBeVisible()
  await modal.locator("#unshare-case-submit").click()
  await expect(modal.locator(".alert-success")).toContainText("unshared", { timeout: 10_000 })

  await modal.getByRole("button", { name: "Cancel" }).click()
  await expect(modal).toBeHidden({ timeout: 5_000 })
}
