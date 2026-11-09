import { test, expect, type Page } from "@playwright/test"
import { cloneRichCase, deleteCaseViaApi, expandFirstQuery, gotoCase } from "./case_helpers"

/**
 * Manual scenarios 4.6 (rate a document) and 4.7 (score badges) end to end on a disposable
 * clone: a rating saves, changes the query and case scores, survives a reload, and RESET
 * clears it again after a reload.
 */

let caseId: number

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage()
  caseId = await cloneRichCase(page, "Rate Score Reload")
  await page.close()
})

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage()
  await page.goto("cases")
  await deleteCaseViaApi(page, caseId)
  await page.close()
})

const firstQuery = (page: Page) => page.locator(".results-list-element > li").first()
const firstDocTrigger = (page: Page) =>
  firstQuery(page).locator("search-result .single-rating button").first()
const queryScore = (page: Page) => firstQuery(page).locator('[data-slot="score"]').first()
const caseScore = (page: Page) => page.locator(".header-rating .scorable-score")

async function openWorkbench(page: Page) {
  await gotoCase(page, "", caseId)
  await expandFirstQuery(page)
  await expect(firstDocTrigger(page)).toBeVisible()
}

async function scoresSettled(page: Page) {
  await expect(queryScore(page)).not.toHaveText(/^\s*$/)
  await expect(caseScore(page)).not.toHaveText(/^\s*$/)
}

test("a rating changes the scores, survives a reload, and RESET clears it", async ({ page }) => {
  await openWorkbench(page)
  await scoresSettled(page)
  const trigger = firstDocTrigger(page)
  const original = await trigger.getAttribute("aria-label")
  const queryBefore = (await queryScore(page).textContent())!.trim()

  await trigger.click()
  const choices = page.locator(".popover .ratingNum")
  await expect(choices.first()).toBeVisible()
  // Move the top document between "not relevant" and "relevant" so every scorer moves, binary
  // ones included: an unrated or minimum document goes to the maximum, anything else to the
  // minimum. Choices read like "1Relevant": the value, then any scale label.
  const values = (await choices.allTextContents()).map((text) => text.trim().match(/^\d+/)![0])
  const lowest = original === "Rate document: Unrated" || original === `Change rating: ${values[0]}`
  const target = lowest ? values.at(-1)! : values[0]
  const savedRating = page.waitForResponse(
    (r) => r.request().method() === "PUT" && /\/ratings(?:\?|$)/.test(r.url())
  )
  const savedScore = page.waitForResponse(
    (r) => r.request().method() === "PUT" && new RegExp(`/cases/${caseId}/scores`).test(r.url())
  )
  await choices.filter({ hasText: new RegExp(`^\\s*${target}(?:\\D|$)`) }).click()
  expect((await savedRating).ok()).toBeTruthy()
  expect((await savedScore).ok()).toBeTruthy()

  await expect(trigger).toHaveAttribute("aria-label", `Change rating: ${target}`)
  await expect(queryScore(page)).not.toHaveText(queryBefore)
  const queryAfter = (await queryScore(page).textContent())!.trim()
  const caseAfter = (await caseScore(page).textContent())!.trim()

  await openWorkbench(page)
  await expect(firstDocTrigger(page)).toHaveAttribute("aria-label", `Change rating: ${target}`)
  await expect(queryScore(page)).toHaveText(queryAfter)
  await expect(caseScore(page)).toHaveText(caseAfter)

  await firstDocTrigger(page).click()
  const removed = page.waitForResponse(
    (r) => r.request().method() === "DELETE" && /\/ratings(?:\?|$)/.test(r.url())
  )
  await page.locator(".popover").getByRole("button", { name: "RESET" }).click()
  expect((await removed).ok()).toBeTruthy()
  await expect(firstDocTrigger(page)).toHaveAttribute("aria-label", "Rate document: Unrated")

  await openWorkbench(page)
  await expect(firstDocTrigger(page)).toHaveAttribute("aria-label", "Rate document: Unrated")
})
