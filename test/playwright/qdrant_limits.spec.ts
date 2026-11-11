import { readFileSync } from "node:fs"
import { test, expect } from "@playwright/test"
import { apiHeaders, createDisposableCase, deleteCaseViaApi } from "./case_helpers"

test.describe("Qdrant query limit and result-count synchronization", () => {
  let caseId: number | undefined
  let endpointId: number | undefined

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage()
    try {
      await page.goto("cases")
      if (caseId) await deleteCaseViaApi(page, caseId)
      if (endpointId) {
        const response = await page.request.delete(`api/search_endpoints/${endpointId}`, {
          headers: await apiHeaders(page)
        })
        expect(response.ok()).toBeTruthy()
      }
    } finally {
      await page.close()
    }
  })

  test("syncs both ways, persists counts above 100, and preserves the outgoing limit", async ({
    page
  }) => {
    caseId = await createDisposableCase(page, "Qdrant Limits")
    const headers = await apiHeaders(page, { "Content-Type": "application/json" })
    const endpoint = await page.request.post("api/search_endpoints", {
      headers,
      data: {
        search_endpoint: {
          name: `Qdrant Limits ${Date.now()}`,
          search_engine: "searchapi",
          api_method: "POST",
          proxy_requests: true,
          endpoint_url: "https://qdrant.invalid/collections/test/points/query",
          mapper_code: readFileSync("db/mapper_based_search_engines/qdrant.js", "utf8")
        }
      }
    })
    expect(endpoint.ok()).toBeTruthy()
    const savedEndpoint = await endpoint.json()
    endpointId = Number(savedEndpoint.search_endpoint_id ?? savedEndpoint.id)
    const createdTry = await page.request.post(`api/cases/${caseId}/tries`, {
      headers,
      data: {
        try: {
          search_endpoint_id: endpointId,
          query_params: '{"query":"#$query##","limit":250,"with_payload":true}',
          field_spec: "id:id title:title",
          number_of_rows: 10
        }
      }
    })
    expect(createdTry.ok()).toBeTruthy()
    const tryNo = (await createdTry.json()).try_number
    const query = await page.request.post(`api/cases/${caseId}/queries`, {
      headers,
      data: { query: { query_text: "matrix" } }
    })
    expect(query.ok()).toBeTruthy()
    const limits: number[] = []
    await page.route("**/proxy/fetch**", async (route) => {
      limits.push(route.request().postDataJSON().limit)
      await route.fulfill({ json: { status: "ok", result: { points: [] } } })
    })
    await page.goto(`case/${caseId}/try/${tryNo}`)
    await page.getByRole("button", { name: "Tune Relevance", exact: true }).click()
    const editor = page.locator("#query-params-editor .cm-content")
    const count = page.locator('[data-tune-relevance-target="numberOfRows"]')
    const tab = (name: string) => page.locator(`[data-tune-relevance-tab-param="${name}"]`)
    await expect(editor).toContainText('"limit":250')
    await tab("engineSettings").click()
    await expect(count).toHaveValue("250")
    await tab("developer").click()
    await editor.fill('{"query":"#$query##","limit":300,"with_payload":true}')
    await tab("engineSettings").click()
    await expect(count).toHaveValue("300")
    await count.fill("500")
    await tab("developer").click()
    await expect(editor).toContainText('"limit": 500')
    await page.getByRole("button", { name: "Rerun My Searches!", exact: true }).click()
    await expect(page).not.toHaveURL(new RegExp(`/try/${tryNo}$`))
    await expect.poll(() => limits.at(-1)).toBe(500)
    await page.reload()
    await page.getByRole("button", { name: "Tune Relevance", exact: true }).click()
    await tab("engineSettings").click()
    await expect(count).toHaveValue("500")
    await tab("developer").click()
    await expect(editor).toContainText('"limit": 500')
    const persistedTryNo = new URL(page.url()).pathname.split("/").at(-1)
    const saved = await (
      await page.request.get(`api/cases/${caseId}/tries/${persistedTryNo}`, { headers })
    ).json()
    expect(saved.number_of_rows).toBe(500)
    expect(JSON.parse(saved.query_params).limit).toBe(500)

    await editor.fill('{"query":"#$query##","with_payload":true}')
    await tab("engineSettings").click()
    await count.fill("700")
    await tab("developer").click()
    await expect(editor).not.toContainText('"limit"')
    const previousUrl = page.url()
    await page.getByRole("button", { name: "Rerun My Searches!", exact: true }).click()
    await expect(page).not.toHaveURL(previousUrl)
    await expect.poll(() => limits.at(-1)).toBe(700)
    await page.reload()
    await page.getByRole("button", { name: "Tune Relevance", exact: true }).click()
    await tab("engineSettings").click()
    await expect(count).toHaveValue("700")
    await tab("developer").click()
    await expect(editor).not.toContainText('"limit"')
    const withoutLimitTryNo = new URL(page.url()).pathname.split("/").at(-1)
    const withoutLimit = await (
      await page.request.get(`api/cases/${caseId}/tries/${withoutLimitTryNo}`, { headers })
    ).json()
    expect(withoutLimit.number_of_rows).toBe(700)
    expect(JSON.parse(withoutLimit.query_params)).not.toHaveProperty("limit")
  })
})
