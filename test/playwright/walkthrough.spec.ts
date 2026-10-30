import { test, expect } from "@playwright/test"
import { CASE_ID } from "./case_helpers"

for (const width of [1280, 768]) {
  test(`walkthrough shading and arrow contact at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`case/${CASE_ID}/try/1?startTour=true`)
    const step = page.locator(".quepid-tour-step:visible")
    await expect(step).toBeVisible()
    await expect(page.locator(".shepherd-modal-overlay-container")).toHaveCSS("opacity", "0.2")
    for (const target of ["#case-header", ".case-score"]) {
      await expect
        .poll(() =>
          step.evaluate((element, selector) => {
            const reference = document.querySelector(selector)!.getBoundingClientRect()
            const arrow = element.querySelector(".shepherd-arrow")!.getBoundingClientRect()
            const placement = (element as HTMLElement).dataset.popperPlacement!.split("-")[0]
            const reach = 8 * Math.SQRT2
            if (placement === "bottom") return Math.abs(arrow.top + 8 - reach - reference.bottom)
            if (placement === "top") return Math.abs(arrow.top + 8 + reach - reference.top)
            if (placement === "right") return Math.abs(arrow.left + 8 - reach - reference.right)
            return Math.abs(arrow.left + 8 + reach - reference.left)
          }, target)
        )
        .toBeLessThan(1)
      await step.getByRole("button", { name: "Next", exact: true }).click()
    }
    await expect(step).toContainText("Add Query")
    await step.getByRole("button", { name: "Close Tour" }).click()
    await expect(step).toHaveCount(0)
  })
}
