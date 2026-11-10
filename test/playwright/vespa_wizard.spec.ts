import { test, expect } from "@playwright/test"
import { createDisposableCase, deleteCaseViaApi } from "./case_helpers"

test.describe("Vespa wizard validation", () => {
  let caseId: number | undefined

  test.afterAll(async ({ browser }) => {
    if (!caseId) return
    const page = await browser.newPage()
    try {
      await page.goto("cases")
      await deleteCaseViaApi(page, caseId)
    } finally {
      await page.close()
    }
  })

  test("parses the preset JSON test query before adding pagination and reaches field selection", async ({
    page
  }) => {
    caseId = await createDisposableCase(page, "Vespa Wizard")
    let requestedYql: string | null = null
    await page.route("**/proxy/fetch**", async (route) => {
      const url = new URL(route.request().url())
      requestedYql = new URL(url.searchParams.get("url")!).searchParams.get("yql")
      expect(url.searchParams.get("hits")).toBe("10")
      expect(url.searchParams.get("offset")).toBe("0")
      await route.fulfill({
        json: {
          root: {
            fields: { totalCount: 1 },
            children: [
              {
                id: "id:movies:movies::603",
                relevance: 1,
                fields: {
                  movie_id: 603,
                  title: "The Matrix",
                  overview: "A hacker learns the truth."
                }
              }
            ]
          }
        }
      })
    })
    await page.goto(`case/${caseId}/try/1?showWizard=true`)
    const wizard = page.locator("#wizardModal")
    const next = () =>
      wizard.getByRole("button", { name: "Continue", exact: true }).filter({ visible: true })
    if (await wizard.getByRole("heading", { name: /Welcome/i }).isVisible()) await next().click()
    await wizard.getByLabel("New Case Name:").fill("Vespa wizard validation")
    await next().click()
    await wizard.getByText("Create a new Search Endpoint", { exact: true }).click()
    await wizard.getByRole("radio", { name: "Vespa", exact: true }).check()
    await next().click()
    await expect(
      wizard.getByRole("heading", { name: "How Should We Display Your Results?" })
    ).toBeVisible()
    expect(requestedYql).toBe("select * from sources * where true")
    await expect(wizard.locator("#wizardIdField")).toHaveValue("movie_id")
    await expect(wizard.locator(".alert:visible")).toHaveCount(0)
  })
})
