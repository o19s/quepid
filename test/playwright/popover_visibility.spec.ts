import { test, expect } from "@playwright/test"
import { expandFirstQuery, gotoCase } from "./case_helpers"

/**
 * The popover node can exist in the DOM with `aria-describedby` set while
 * remaining unpainted (e.g. `display: none` / `opacity: 0` from BS3 `.fade`
 * or cascade clashes). Screenshot diffs in an empty region can miss that.
 *
 * This spec fails fast on that class of regression without relying on pixels.
 */

test.describe("BS3↔BS5 popover paint (trap #5)", () => {
  test("finder rating choices are keyboard reachable and restore focus after saving", async ({
    page
  }) => {
    // The static fixture cannot look up rated documents; use the existing Solr case.
    await gotoCase(page, "", 6)
    await expandFirstQuery(page)
    await page.getByRole("button", { name: "Missing Documents", exact: true }).click()
    const modal = page.locator(".modal.show")
    const trigger = modal.locator("search-result .single-rating button").first()
    const original = (await trigger.getAttribute("aria-label"))!.replace("Change rating: ", "")
    await trigger.press("Enter")
    const choices = modal.locator(".popover .ratingNum")
    await expect(choices.first()).toBeVisible()
    const choice = choices.filter({ hasText: new RegExp(`^${original}(?:\\D|$)`) })
    for (
      let step = 0;
      step < 40 && !(await choice.evaluate((el) => el === document.activeElement));
      step++
    ) {
      await page.keyboard.press("Tab")
    }
    await expect(choice).toBeFocused()
    const saved = page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" && /\/ratings(?:\?|$)/.test(response.url())
    )
    await page.keyboard.press("Enter")
    expect((await saved).ok()).toBeTruthy()
    await expect(modal.locator(".popover")).toHaveCount(0)
    await expect(trigger).toBeFocused()
    await trigger.press("Enter")
    await page.keyboard.press("Escape")
    await expect(modal).toHaveCount(0)
    await expect(page.locator(".popover")).toHaveCount(0)
  })

  test("judgement popover tip is visible in computed style", async ({ page }) => {
    await gotoCase(page)
    await expandFirstQuery(page)

    const trigger = page.locator("search-result .single-rating").first()
    await trigger.click()

    await expect(trigger).toHaveAttribute("aria-describedby", /\S+/, { timeout: 5_000 })
    const tipId = await trigger.getAttribute("aria-describedby")
    // eslint-disable-next-line playwright/prefer-web-first-assertions -- tip id is used below
    expect(tipId, "Bootstrap should link trigger to tip via aria-describedby").toBeTruthy()

    const paint = await page.evaluate((id: string) => {
      const el = document.getElementById(id)
      if (!el) {
        return { ok: false as const, reason: "missing-element" }
      }
      const s = getComputedStyle(el)
      const opacity = parseFloat(s.opacity || "0")
      return {
        ok: true as const,
        display: s.display,
        opacity
      }
    }, tipId!)

    if (!paint.ok) {
      throw new Error(`Popover tip #${tipId} not found while aria-describedby is set`)
    }

    const { display, opacity } = paint

    expect(
      display,
      'getComputedStyle(display) must not be "none" (invisible-but-present tip)'
    ).not.toBe("none")

    expect(opacity, "getComputedStyle(opacity) must be > 0").toBeGreaterThan(0)
  })

  test("rating and Matches popovers toggle and dismiss outside the tip", async ({ page }) => {
    await gotoCase(page)
    await expandFirstQuery(page)
    const rating = page.locator("search-result .single-rating").first()
    await rating.click()
    await expect(page.locator(".popover")).toBeVisible()
    await page.locator(".popover").click({ position: { x: 3, y: 3 } })
    await expect(page.locator(".popover")).toBeVisible()
    await rating.click()
    await expect(page.locator(".popover")).toHaveCount(0)
    await rating.click()
    await page.locator("body").click({ position: { x: 1, y: 1 } })
    await expect(page.locator(".popover")).toHaveCount(0)

    await page.locator("search-result .matches-popper").first().click()
    await expect(page.locator(".popover")).toBeVisible()
    await expect(page.locator(".popover").getByText("Expand", { exact: false })).toBeVisible()
    await page.locator("body").click({ position: { x: 1, y: 1 } })
    await expect(page.locator(".popover")).toHaveCount(0)
  })
})
