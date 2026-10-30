import { test, expect } from "@playwright/test"
import { apiHeaders, createCaseViaApi, deleteCaseViaApi } from "./case_helpers"

// WarpSearch is searched through Quepid's proxy by default, so intercept the proxy response here
// rather than calling a live WarpSearch collection (that needs a real API key; see manual 7.14).
test.describe("WarpSearch case wizard", () => {
  let caseId: number | undefined
  let endpointId: number | undefined
  const endpointMarker = `quepid_e2e=warpsearch-${Date.now()}`
  let userId: number
  let completedWizard: boolean

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: "test/playwright/.auth/user.json" })
    const page = await context.newPage()
    await page.goto("cases")
    const headers = await apiHeaders(page)
    const errors: unknown[] = []
    const attempt = async (action: () => Promise<void>) => {
      try {
        await action()
      } catch (error) {
        errors.push(error)
      }
    }
    try {
      if (caseId) {
        await attempt(async () => {
          if (!endpointId) {
            const saved = await page.request.get(`api/cases/${caseId}/tries/1`, { headers })
            if (saved.ok()) {
              const settings = await saved.json()
              if (settings.search_url?.includes(endpointMarker))
                endpointId = settings.search_endpoint_id
            }
          }
        })
        await attempt(async () => {
          await deleteCaseViaApi(page, caseId!)
        })
      }
      if (endpointId) {
        await attempt(async () => {
          const response = await page.request.delete(`api/search_endpoints/${endpointId}`, {
            headers
          })
          expect(response.ok()).toBeTruthy()
        })
      }
      if (userId) {
        await attempt(async () => {
          const response = await page.request.put(`api/users/${userId}`, {
            headers,
            data: { user: { completed_case_wizard: completedWizard } }
          })
          expect(response.ok()).toBeTruthy()
        })
      }
    } finally {
      await context.close()
    }
    if (errors.length) throw new AggregateError(errors, "WarpSearch fixture cleanup failed")
  })

  test("sends OpenSearch queries with the API key, and keeps the engine as WarpSearch", async ({
    page
  }) => {
    await page.goto("cases")
    const headers = await apiHeaders(page)
    const me = await (await page.request.get("api/users/current", { headers })).json()
    userId = me.id
    completedWizard = me.completed_case_wizard
    caseId = await createCaseViaApi(page, `WarpSearch E2E ${Date.now()}`)

    try {
      type Body = { query?: { bool?: { filter?: { terms?: { _id?: string[] } } } } }
      const requests: { url: string; authorization?: string; body: Body }[] = []
      const hit = { _id: "dune", _score: 2.5, _source: { title: "Dune", year: 1965 } }
      await page.route("**/proxy/fetch**", async (route) => {
        const request = route.request()
        const body = request.postDataJSON() || {}
        requests.push({
          url: new URL(request.url()).searchParams.get("url") || "",
          authorization: request.headers()["authorization"],
          body
        })
        const ids = body.query?.bool?.filter?.terms?._id ?? body.query?.terms?._id
        const hits = !ids || ids.includes("dune") ? [hit] : []
        await route.fulfill({
          json: {
            took: 1,
            hits: { total: { value: hits.length, relation: "eq" }, max_score: 2.5, hits }
          }
        })
      })

      await page.goto(`case/${caseId}/try/1?showWizard=true`)
      const modal = page.locator("#wizardModal")
      const next = () =>
        modal.getByRole("button", { name: "Continue", exact: true }).filter({ visible: true })
      await expect(modal).toBeVisible()
      // Existing users skip Welcome; preserve their stored onboarding preference.
      if (completedWizard === false) await next().click()
      await modal.getByLabel("New Case Name:").fill("WarpSearch E2E")
      await next().click()
      await modal.locator("summary", { hasText: "Create a new Search Endpoint" }).click()
      await modal.getByRole("radio", { name: "WarpSearch" }).check()

      const url = modal.getByPlaceholder("Search endpoint URL")
      await expect(url).toHaveValue(
        "https://api.warpsearch.io/compat/opensearch/YOUR_COLLECTION/_search"
      )
      // Endpoint assignment deduplicates by configuration; isolate this test's row.
      await url.fill(`https://api.warpsearch.io/compat/opensearch/books/_search?${endpointMarker}`)
      await modal.locator("summary", { hasText: "Advanced" }).click()
      await expect(modal.getByLabel("Proxy requests through Quepid")).toBeChecked()
      await expect(modal.getByLabel("API method")).toBeHidden()
      await expect(modal.locator('[data-wizard-target="basicAuth"]')).toBeHidden()
      const customHeaders = modal.getByLabel("Custom headers JSON")
      await expect(customHeaders).toHaveValue(/Bearer ws_live_REPLACE_ME/)
      await customHeaders.fill('{"Authorization": "Bearer ws_live_e2e"}')

      await next().click()
      await expect(
        modal.getByRole("heading", { name: "How Should We Display Your Results?" })
      ).toBeVisible({ timeout: 20_000 })
      expect(requests[0].url).toContain("/compat/opensearch/books/_search")
      expect(requests[0].authorization).toBe("Bearer ws_live_e2e")

      for (const [id, value] of [
        ["wizardTitleField", "title"],
        ["wizardIdField", "_id"]
      ]) {
        await page.locator(`#${id} + .ts-wrapper .ts-control`).click()
        await page.locator(`#${id}-ts-control`).fill(value)
        await page.locator(`#${id}-ts-dropdown .option[data-value="${value}"]`).click()
      }
      await next().click()
      await modal.getByPlaceholder("Search query").fill("dune")
      await modal.getByRole("button", { name: "Add Query", exact: true }).click()
      await next().click()
      await modal.getByRole("button", { name: "Finish", exact: true }).click()
      await expect(modal).toBeHidden({ timeout: 30_000 })

      const settings = await (
        await page.request.get(`api/cases/${caseId}/tries/1`, { headers })
      ).json()
      expect(settings.search_url).toContain(endpointMarker)
      endpointId = settings.search_endpoint_id
      expect(settings.search_engine).toBe("warpsearch")
      expect(settings.api_method).toBe("POST")
      expect(settings.proxy_requests).toBe(true)

      await page.getByRole("heading", { name: "dune", exact: true }).click()
      const result = page.locator("search-result").first()
      await expect(result).toContainText("Dune")
      await expect(result).toHaveAttribute("data-doc-id", "dune")
      await result.getByRole("button", { name: "Rate document: Unrated" }).click()
      await page.locator(".popover.show").getByRole("button", { name: /^1/ }).click()
      await expect(result).toHaveAttribute("data-rating", "1")

      // Reloading keeps the engine as WarpSearch, not the OpenSearch searcher it runs on.
      await page.reload()
      await page.getByRole("heading", { name: "dune", exact: true }).click()
      await expect(result).toHaveAttribute("data-rating", "1")
      await page.getByRole("button", { name: "Show only rated", exact: true }).click()
      await expect
        .poll(() =>
          requests.some((request) => request.body.query?.bool?.filter?.terms?._id?.includes("dune"))
        )
        .toBeTruthy()
      await expect(result).toContainText("Dune")
      const saved = await (
        await page.request.get(`api/cases/${caseId}/tries/1`, { headers })
      ).json()
      expect(saved.search_engine).toBe("warpsearch")
    } finally {
      // Drain score/rating writes before afterAll deletes their case, even on assertion failure.
      // eslint-disable-next-line playwright/no-networkidle -- drain writes before teardown
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {})
      await page.goto("cases")
    }
  })
})
