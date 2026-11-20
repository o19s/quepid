import { test, expect } from "@playwright/test"
import { createDisposableCase, deleteCaseViaApi } from "./case_helpers"

test.describe("search endpoint discovery", () => {
  const caseIds: number[] = []

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage()
    try {
      await page.goto("cases")
      for (const caseId of caseIds) await deleteCaseViaApi(page, caseId)
    } finally {
      await page.close()
    }
  })

  for (const surface of ["wizard", "tuning"]) {
    test(`explains the cap and selects an endpoint beyond it in ${surface}`, async ({ page }) => {
      const caseId = await createDisposableCase(page, "Endpoint Discovery")
      caseIds.push(caseId)
      const endpoints = Array.from({ length: 505 }, (_, index) => ({
        search_endpoint_id: 900000 + index,
        name: `${index < 180 ? "Group" : "Other"} endpoint ${index + 1}`,
        search_engine: "solr",
        endpoint_url: `https://endpoint.invalid/${index + 1}`,
        api_method: "GET"
      }))
      await page.route("**/api/search_endpoints*", (route) =>
        route.fulfill({ json: { search_endpoints: endpoints } })
      )
      await page.route(`**/api/cases/${caseId}/search_endpoints*`, (route) =>
        route.fulfill({ json: { search_endpoints: endpoints } })
      )
      await page.goto(`case/${caseId}/try/1${surface === "wizard" ? "?showWizard=true" : ""}`)
      let selector: string
      if (surface === "wizard") {
        const wizard = page.locator("#wizardModal")
        await expect(wizard).toBeVisible()
        const next = () =>
          wizard.getByRole("button", { name: "Continue", exact: true }).filter({ visible: true })
        if (await wizard.getByRole("heading", { name: /Welcome/i }).isVisible())
          await next().click()
        await wizard.getByLabel("New Case Name:").fill("Endpoint discovery")
        await next().click()
        await wizard
          .locator("summary")
          .filter({ hasText: "Use an existing Search Endpoint" })
          .click()
        selector = "#wizardEndpoint"
      } else {
        await page.getByRole("button", { name: "Tune Relevance", exact: true }).click()
        await page.locator('[data-tune-relevance-tab-param="engineSettings"]').click()
        await page.locator('.dev-header[data-tune-relevance-section-param="search"]').click()
        selector = '[data-tune-relevance-target="endpointSelect"]'
      }
      const input = page.locator(`${selector} + .ts-wrapper input`)
      const dropdown = page.locator(`${selector} + .ts-wrapper .ts-dropdown`)
      await page.locator(`${selector} + .ts-wrapper .ts-control`).click()
      await expect(input).toHaveAttribute("placeholder", "Search 505 endpoints…")
      await expect(dropdown.getByRole("status")).toHaveText(
        "Showing 50 of 505 endpoints. Type to search all endpoints."
      )
      await input.fill("Group")
      await expect(dropdown.getByRole("status")).toHaveText(
        "Showing 50 of 180 matches. Keep typing to narrow."
      )
      await input.fill("Other endpoint 505")
      await expect(dropdown.getByRole("status")).toHaveText("1 matching endpoint.")
      await dropdown.locator(".option").click()
      await expect(page.locator(selector)).toHaveValue("900504")
    })
  }
})
