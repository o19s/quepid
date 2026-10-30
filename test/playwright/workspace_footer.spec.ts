import { test, expect, type Page } from "@playwright/test"
import { gotoCase } from "./case_helpers"

async function showFlash(page: Page, target: string, type: string, message: string) {
  await page.evaluate(
    (detail) => document.dispatchEvent(new CustomEvent("flash:show", { detail })),
    {
      target,
      type,
      message
    }
  )
}

async function expectFlashOverFooter(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const footer = document.querySelector("footer")!.getBoundingClientRect()
        const flashes = document.querySelector("#flash-messages")!.getBoundingClientRect()
        return Math.max(Math.abs(flashes.bottom - window.innerHeight), flashes.top - footer.bottom)
      })
    )
    .toBeLessThanOrEqual(1)
}

test("case footer matches homepage spacing and flashes overlap it when the drawer resizes", async ({
  page
}) => {
  await page.route("**/api/cases/*/scores", (route) =>
    route.request().method() === "PUT"
      ? route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
      : route.fallback()
  )
  await page.setViewportSize({ width: 1200, height: 900 })
  await page.goto("")
  const home = await page.locator("footer").evaluate((el) => ({
    height: el.getBoundingClientRect().height,
    top: getComputedStyle(el).paddingTop,
    bottom: getComputedStyle(el).paddingBottom
  }))
  await gotoCase(page)
  await page.evaluate(() => {
    for (const target of ["main", "search-error"]) {
      document.dispatchEvent(new CustomEvent("flash:hide", { detail: { target } }))
    }
  })
  await page.locator("footer").scrollIntoViewIfNeeded()
  const footer = await page.locator("footer").evaluate((el) => ({
    height: el.getBoundingClientRect().height,
    top: getComputedStyle(el).paddingTop,
    bottom: getComputedStyle(el).paddingBottom
  }))
  expect(footer).toEqual(home)

  await showFlash(page, "search-error", "error", "Search failed. Please try again.")
  await expect(page.locator("#flash-messages .alert-danger")).toBeVisible()
  await expectFlashOverFooter(page)
  await showFlash(page, "main", "notice", "Saved successfully.")
  await expect(page.locator("#flash-messages .show")).toHaveCount(2)
  await expectFlashOverFooter(page)

  await page.getByRole("button", { name: "Tune Relevance", exact: true }).click()
  await expect(page.locator(".pane_east")).toBeVisible()
  await page.locator("footer").scrollIntoViewIfNeeded()
  await expectFlashOverFooter(page)
  await expect
    .poll(() =>
      page.locator(".pane_east").evaluate((el) => {
        const flashTop = document.querySelector("#flash-messages")!.getBoundingClientRect().top
        return el.getBoundingClientRect().bottom - flashTop
      })
    )
    .toBeLessThanOrEqual(1)
  await page.locator('#flash-messages [data-flash-channel-value="search-error"] button').click()
  await expect(page.locator("#flash-messages .alert-danger")).toHaveCount(0)
})
