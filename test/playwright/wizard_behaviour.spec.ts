import { test, expect, type Page, type Route } from "@playwright/test"
import {
  apiHeaders,
  createDisposableCase,
  deleteCaseViaApi,
  resetCompletedCaseWizard
} from "./case_helpers"

/**
 * Behaviour of the case-creation wizard (Stimulus `wizard` controller, app/views/shared/_wizard_modal.html.erb)
 * against the running app. wizard_completion.spec.ts walks the happy path; this covers the rules around it:
 * validation and troubleshooting, engine-specific controls, mapper endpoints, static CSV import, field
 * suggestions, and Finish.
 *
 * Every test runs the wizard on a disposable case (Finish renames and fills the current case, so a shared one
 * would be corrupted) and creates any endpoint it needs through the API. A third-party search engine is
 * stubbed with `page.route` where a test needs a known response, since the wizard asks the browser to call
 * it directly. The one thing the live app cannot show is the instance-wide required-proxy policy, which is
 * server configuration: CoreControllerTest covers it.
 */

const ENGINE_URL = "http://wizard.invalid/solr/tmdb/select"
const DISCOVERED_FIELDS = ["id", "title", "body", "year", "poster_path", "cast"]

// The wizard asks the browser to call the engine directly, with credentials, so the stub answers CORS
// preflights and echoes the page's origin.
const cors = (route: Route) => ({
  "access-control-allow-origin": route.request().headers()["origin"] ?? "*",
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "*"
})

const solrResponse = {
  responseHeader: { status: 0, QTime: 1, params: {} },
  response: {
    numFound: 1,
    start: 0,
    docs: [
      {
        id: "1",
        title: "Star Wars",
        body: "A long time ago",
        year: 1977,
        poster_path: "/sw.jpg",
        cast: "Mark Hamill"
      }
    ]
  }
}

test.describe("Case creation wizard behaviour", () => {
  let caseId: number
  let draftDeleted: boolean
  let endpointIds: number[]

  const modal = (page: Page) => page.locator(".modal.show").first()
  const wizard = (page: Page) => page.locator("#wizardModal")
  const field = (page: Page, name: string) => page.locator(`[data-wizard-target="${name}"]`)
  const when = (page: Page, state: string) => wizard(page).locator(`[data-wizard-when="${state}"]`)
  const next = (page: Page) =>
    modal(page)
      .getByRole("button", { name: /^Continue$/i })
      .filter({ visible: true })
  const engine = (page: Page, name: string) =>
    wizard(page).locator(`input[name="wizardEngine"][value="${name}"]`).check({ force: true })
  const ping = (page: Page) =>
    wizard(page)
      .locator("button[data-wizard-target~='pingButton']")
      .filter({ visible: true })
      .click()
  const alert = (page: Page) => wizard(page).locator('.alert:visible, [role="alert"]:visible')
  // Solr Configuration and Advanced start collapsed, as in the Angular wizard.
  const section = (page: Page, name: string) =>
    wizard(page)
      .locator("details:not(.wizard-endpoint-panel)")
      .filter({ has: page.locator(":scope > summary", { hasText: name }) })
  // The Endpoint step is an accordion, both panels closed on arrival, as in the Angular wizard.
  const panel = (page: Page, name: string) =>
    wizard(page)
      .locator("details.wizard-endpoint-panel")
      .filter({ has: page.locator("summary", { hasText: name }) })
  async function openPanel(
    page: Page,
    name: "Create a new Search Endpoint" | "Use an existing Search Endpoint"
  ) {
    const details = panel(page, name)
    if (!(await details.evaluate((element) => (element as HTMLDetailsElement).open)))
      await details.locator("> summary").click()
  }
  const openExisting = (page: Page) => openPanel(page, "Use an existing Search Endpoint")
  async function openSection(page: Page, name: string) {
    const details = section(page, name)
    if (!(await details.evaluate((element) => (element as HTMLDetailsElement).open)))
      await details.locator("summary").click()
  }

  async function createEndpoint(
    page: Page,
    attrs: Record<string, unknown>
  ): Promise<{ id: number; name: string }> {
    const name = `Playwright Wizard Endpoint ${Date.now()}-${endpointIds.length}`
    const response = await page.request.post("api/search_endpoints", {
      headers: await apiHeaders(page, { "Content-Type": "application/json" }),
      data: {
        search_endpoint: {
          name,
          endpoint_url: ENGINE_URL,
          search_engine: "solr",
          api_method: "GET",
          ...attrs
        }
      }
    })
    expect(response.ok(), `endpoint create: ${response.status()}`).toBeTruthy()
    const created = await response.json()
    const id = Number(created.search_endpoint_id ?? created.id)
    endpointIds.push(id)
    expect(id).toBeGreaterThan(0)
    return { id, name }
  }

  /** Answers the stubbed engine for the browser, so no external search engine is involved. */
  async function stubEngine(
    page: Page,
    handler: (route: Route) => unknown = (route) =>
      route.fulfill({
        json: solrResponse,
        headers: cors(route)
      })
  ) {
    await page.route("http://wizard.invalid/**", handler)
  }

  /** Opens the wizard on the disposable case and moves from Welcome to the Endpoint step. */
  async function toEndpointStep(page: Page) {
    await page.goto(`case/${caseId}/try/1?showWizard=true`)
    await expect(modal(page)).toBeVisible({ timeout: 15_000 })
    await expect(modal(page).getByRole("heading", { name: /Welcome To Quepid/i })).toBeVisible({
      timeout: 15_000
    })
    await next(page).click()
    const name = modal(page).getByLabel("New Case Name:")
    await name.evaluate((el: HTMLElement) => el.focus())
    await name.fill(`Playwright Wizard Behaviour ${Date.now()}`, { force: true })
    await next(page).click()
    await expect(modal(page).getByRole("heading", { name: /What Search Endpoint/i })).toBeVisible({
      timeout: 15_000
    })
    await openPanel(page, "Create a new Search Endpoint")
  }

  async function useStubbedSolr(page: Page) {
    await field(page, "searchUrl").fill(ENGINE_URL)
    await openSection(page, "Solr Configuration")
    await page.locator("#wizardApiMethod").selectOption("GET")
  }

  async function toFieldsStep(page: Page) {
    await toEndpointStep(page)
    await useStubbedSolr(page)
    await next(page).click()
    await expect(modal(page).getByRole("heading", { name: /How Should We Display/i })).toBeVisible({
      timeout: 20_000
    })
  }

  async function chooseEndpoint(page: Page, name: string) {
    const wrapper = page.locator("#wizardEndpoint + .ts-wrapper")
    await wrapper.locator(".ts-control").click()
    await wrapper.locator("input").fill(name)
    await wrapper.locator(".option").filter({ hasText: name }).click()
  }

  async function chooseTitleAndId(page: Page) {
    for (const [id, value] of [
      ["wizardTitleField", "title"],
      ["wizardIdField", "id"]
    ]) {
      await page.locator(`#${id} + .ts-wrapper .ts-control`).click()
      await page.locator(`#${id}-ts-control`).fill(value)
      await page.locator(`#${id}-ts-dropdown .option[data-value="${value}"]`).click()
    }
  }

  async function addQueryAndFinish(page: Page, query = "star wars") {
    await chooseTitleAndId(page)
    await next(page).click()
    await expect(
      modal(page).getByRole("heading", { name: /Add Your Search Queries/i })
    ).toBeVisible()
    await modal(page).getByPlaceholder("Search query").fill(query)
    await modal(page).getByRole("button", { name: "Add Query", exact: true }).click()
    await next(page).click()
    await expect(modal(page).getByRole("heading", { name: "That's It!" })).toBeVisible()
  }

  test.beforeEach(async ({ page }) => {
    caseId = await createDisposableCase(page, "Wizard Behaviour")
    draftDeleted = false
    endpointIds = []
    await resetCompletedCaseWizard(page)
  })

  test.afterEach(async ({ page }) => {
    try {
      // eslint-disable-next-line playwright/no-networkidle -- drain writes before teardown
      await page.waitForLoadState("networkidle").catch(() => {})
      await page.unrouteAll({ behavior: "ignoreErrors" })
      await page.goto("cases")
      if (!draftDeleted) await deleteCaseViaApi(page, caseId)
      for (const id of endpointIds) {
        const response = await page.request.delete(`api/search_endpoints/${id}`, {
          headers: await apiHeaders(page)
        })
        expect(response.ok(), `endpoint ${id} cleanup failed: ${response.status()}`).toBeTruthy()
      }
    } finally {
      await resetCompletedCaseWizard(page)
    }
  })

  test("pings without advancing, then continues to the discovered field choices", async ({
    page
  }) => {
    await stubEngine(page)
    await toEndpointStep(page)
    await useStubbedSolr(page)
    await ping(page)
    await expect(wizard(page).locator(".alert-success:visible")).toBeVisible()
    await expect(modal(page).getByRole("heading", { name: /What Search Endpoint/i })).toBeVisible()

    await next(page).click()
    await expect(modal(page).getByRole("heading", { name: /How Should We Display/i })).toBeVisible({
      timeout: 20_000
    })
    const discovered = await page
      .locator("#wizardSearchFields option")
      .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value))
    expect(discovered.sort()).toEqual([...DISCOVERED_FIELDS].sort())
    await chooseTitleAndId(page)
    await next(page).click()
    await expect(
      modal(page).getByRole("heading", { name: /Add Your Search Queries/i })
    ).toBeVisible()
  })

  for (const name of ["solr", "es", "os", "searchapi"]) {
    test(`shows ${name} troubleshooting on a connection failure and hides the proxy hints once proxying`, async ({
      page
    }) => {
      await stubEngine(page, (route) => route.abort("failed"))
      await toEndpointStep(page)
      await engine(page, name)
      await field(page, "searchUrl").fill(ENGINE_URL)
      await ping(page)

      const panel = wizard(page).locator('[data-wizard-when="url-invalid"]').first()
      await expect(panel).toBeVisible({ timeout: 20_000 })
      for (const other of ["solr", "es", "os", "searchapi"]) {
        await expect(panel.locator(`[data-wizard-when="${other}"]`)).toBeVisible({
          visible: other === name
        })
      }
      const hints = panel.locator(`[data-wizard-when="${name}"] [data-wizard-when="no-proxy"]`)
      await openSection(page, "Advanced")
      const proxy = page.locator("#wizardProxy")
      // The proxy hints show only while requests are not proxied (Search API starts out proxied).
      const proxiedAtStart = await proxy.isChecked()
      await expect(hints.first()).toBeVisible({ visible: !proxiedAtStart })
      if (name === "solr") {
        // JSONP cannot be proxied
        await openSection(page, "Solr Configuration")
        await page.locator("#wizardApiMethod").selectOption("GET")
      }
      await proxy.check({ force: true })
      await ping(page)
      await expect(panel).toBeVisible({ timeout: 30_000 })
      await expect(hints.filter({ visible: true })).toHaveCount(0)
    })
  }

  test("replaces connection troubleshooting with TLS guidance on a protocol mismatch", async ({
    page
  }) => {
    await stubEngine(page, (route) => route.abort("failed"))
    await toEndpointStep(page)
    await field(page, "searchUrl").fill(ENGINE_URL)
    await ping(page)
    await expect(wizard(page).locator('[data-wizard-when="url-invalid"]').first()).toBeVisible({
      timeout: 20_000
    })

    await field(page, "searchUrl").fill("https://wizard.invalid/solr/select")
    await expect(field(page, "tlsWarning")).toBeVisible()
    await expect(wizard(page).locator('[data-wizard-when="url-invalid"]').first()).toBeHidden()
    await expect(wizard(page).locator('[data-wizard-target~="endpointContinue"]')).toBeHidden()
  })

  test("offers Skip Validation only after a connection failure, and skipping moves on to the fields", async ({
    page
  }) => {
    await stubEngine(page, (route) => route.abort("failed"))
    await toEndpointStep(page)
    await useStubbedSolr(page)
    const skip = field(page, "skipButton")
    await expect(skip).toBeHidden()
    await ping(page)
    await expect(skip).toBeVisible({ timeout: 20_000 })
    await expect(when(page, "mapper-invalid")).toBeHidden()
    await skip.click()
    await expect(modal(page).getByRole("heading", { name: /How Should We Display/i })).toBeVisible()
  })

  const WORKING_MAPPER =
    "numberOfResultsMapper = function (data) { return data.results.length };\n" +
    "docsMapper = function (data) { return data.results };"

  async function chooseExistingSearchApi(page: Page, endpoint: { name: string }) {
    await openExisting(page)
    await chooseEndpoint(page, endpoint.name)
  }

  test("stops on a mapper that fails on the API response, without offering Skip Validation", async ({
    page
  }) => {
    const failing = await createEndpoint(page, {
      search_engine: "searchapi",
      endpoint_url: "http://wizard.invalid/api",
      test_query: "star wars",
      mapper_code:
        'numberOfResultsMapper = function (data) { return data.results.length };\ndocsMapper = function () { throw new Error("boom") };'
    })
    await stubEngine(page, (route) =>
      route.fulfill({ json: { results: [{ id: "1", title: "Star Wars" }] }, headers: cors(route) })
    )
    await toEndpointStep(page)
    await chooseExistingSearchApi(page, failing)
    await next(page).click()
    await expect(when(page, "mapper-invalid")).toBeVisible({ timeout: 20_000 })
    await expect(field(page, "mapperMessage")).toContainText("docsMapper")
    await expect(field(page, "skipButton")).toBeHidden()
    await expect(modal(page).getByRole("heading", { name: /What Search Endpoint/i })).toBeVisible()
  })

  for (const [label, mapperCode, message] of [
    [
      "has no numberOfResultsMapper",
      "docsMapper = function (data) { return data.results };",
      'You need to define a "numberOfResultsMapper"'
    ],
    [
      "has no docsMapper",
      "numberOfResultsMapper = function (data) { return 1 };",
      'You need to define a "docsMapper"'
    ],
    ["is not valid JavaScript", "this is not javascript", "Mapper code evaluation failed"]
  ] as const) {
    test(`rejects a mapper that ${label}`, async ({ page }) => {
      const broken = await createEndpoint(page, {
        search_engine: "searchapi",
        endpoint_url: "http://wizard.invalid/api",
        test_query: "star wars",
        mapper_code: mapperCode
      })
      await stubEngine(page, (route) =>
        route.fulfill({
          json: { results: [{ id: "1", title: "Star Wars" }] },
          headers: cors(route)
        })
      )
      await toEndpointStep(page)
      await chooseExistingSearchApi(page, broken)
      await next(page).click()
      await expect(when(page, "mapper-invalid")).toBeVisible({ timeout: 20_000 })
      await expect(field(page, "mapperMessage")).toContainText(message)
      await expect(
        modal(page).getByRole("heading", { name: /What Search Endpoint/i })
      ).toBeVisible()
    })
  }

  test("offers the fields a working mapper finds in the API response", async ({ page }) => {
    const working = await createEndpoint(page, {
      search_engine: "searchapi",
      endpoint_url: "http://wizard.invalid/api",
      test_query: "star wars",
      mapper_code: WORKING_MAPPER
    })
    await stubEngine(page, (route) =>
      route.fulfill({
        json: { results: [{ id: "1", title: "Star Wars", body: "A long time ago", year: 1977 }] },
        headers: cors(route)
      })
    )
    await toEndpointStep(page)
    await chooseExistingSearchApi(page, working)
    await next(page).click()
    await expect(modal(page).getByRole("heading", { name: /How Should We Display/i })).toBeVisible({
      timeout: 20_000
    })
    const discovered = await page
      .locator("#wizardSearchFields option")
      .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value))
    expect(discovered.sort()).toEqual(["body", "id", "title", "year"])
  })

  test("requires a mapper for a new generic API, but permits an existing endpoint", async ({
    page
  }) => {
    const existing = await createEndpoint(page, {
      search_engine: "searchapi",
      mapper_code: "var nothing = 1",
      test_query: "star wars"
    })
    await toEndpointStep(page)
    await engine(page, "searchapi")
    await expect(when(page, "mapper-required")).toBeVisible()
    await expect(wizard(page).locator('[data-wizard-target~="endpointContinue"]')).toBeHidden()
    await expect(
      wizard(page).locator("button[data-wizard-target~='pingButton']").filter({ visible: true })
    ).toBeVisible()

    await openExisting(page)
    await chooseEndpoint(page, existing.name)
    await expect(when(page, "mapper-required")).toBeHidden()
    await expect(wizard(page).locator('[data-wizard-target~="endpointContinue"]')).toBeVisible()
  })

  test("sets an existing Search API endpoint's query pattern on the Query step, seeded from its test query", async ({
    page
  }) => {
    const endpoint = await createEndpoint(page, {
      search_engine: "searchapi",
      endpoint_url: "http://wizard.invalid/api",
      api_method: "GET",
      mapper_code: WORKING_MAPPER,
      test_query: "star wars"
    })
    await stubEngine(page, (route) =>
      route.fulfill({ json: { results: [{ id: "1", title: "Star Wars" }] }, headers: cors(route) })
    )
    await toEndpointStep(page)
    await chooseExistingSearchApi(page, endpoint)
    await expect(
      modal(page).getByText("You'll configure the query pattern in a later step.")
    ).toBeVisible()
    await expect(modal(page).getByLabel("Query Pattern").filter({ visible: true })).toHaveCount(0)
    await next(page).click()
    await expect(modal(page).getByRole("heading", { name: /How Should We Display/i })).toBeVisible({
      timeout: 20_000
    })
    await chooseTitleAndId(page)
    await next(page).click()
    await expect(
      modal(page).getByRole("heading", { name: /Add Your Search Queries/i })
    ).toBeVisible()

    // As in the Angular wizard: a one-line GET pattern seeded from the test query, which warns until it has the placeholder.
    const pattern = modal(page).getByLabel("Query Pattern").filter({ visible: true })
    await expect(pattern).toHaveValue("star wars")
    expect(await pattern.evaluate((element) => element.tagName)).toBe("INPUT")
    await expect(field(page, "selectedEndpointUrl").filter({ visible: true })).toHaveText(
      "http://wizard.invalid/api"
    )
    await expect(when(page, "query-pattern-no-placeholder")).toBeVisible()
    await pattern.fill("")
    await expect(when(page, "query-pattern-empty")).toBeVisible()
    await expect(next(page)).toBeDisabled()
    await pattern.fill("q=#$query##")
    await expect(when(page, "query-pattern-empty")).toBeHidden()
    await expect(when(page, "query-pattern-no-placeholder")).toBeHidden()
    await expect(next(page)).toBeEnabled()
  })

  test("requires a test query before continuing with an existing Search API endpoint", async ({
    page
  }) => {
    const untested = await createEndpoint(page, {
      search_engine: "searchapi",
      mapper_code: "var nothing = 1",
      test_query: ""
    })
    await toEndpointStep(page)
    await openExisting(page)
    await chooseEndpoint(page, untested.name)
    const proceed = wizard(page).locator('[data-wizard-target~="endpointContinue"]')
    await expect(when(page, "test-query-required")).toBeVisible()
    await expect(proceed).toBeDisabled()
    await expect(
      wizard(page).locator("button[data-wizard-target~='pingButton']").filter({ visible: true })
    ).toBeEnabled()
    await page.locator("#wizardTestQuery").fill("shirts")
    await expect(when(page, "test-query-required")).toBeHidden()
    await expect(proceed).toBeEnabled()
  })

  test("fills a header template for the chosen type, and shows an existing endpoint's headers as Custom", async ({
    page
  }) => {
    const keyed = await createEndpoint(page, { custom_headers: '{"X-Key":"1"}' })
    await toEndpointStep(page)
    await openSection(page, "Advanced")
    const headers = field(page, "customHeaders")
    await expect(page.locator("#wizardHeaderType")).toHaveValue("None")
    await expect(headers).toHaveJSProperty("readOnly", true)
    await page.locator("#wizardHeaderType").selectOption("API Key")
    await expect(headers).toHaveValue('{\n  "Authorization": "ApiKey XXX"\n}')
    await expect(headers).toHaveJSProperty("readOnly", false)
    await page.locator("#wizardHeaderType").selectOption("Custom")
    await expect(headers).toHaveValue('{\n "KEY": "VALUE"\n}')
    await page.locator("#wizardHeaderType").selectOption("None")
    await expect(headers).toHaveValue("")
    await expect(headers).toHaveJSProperty("readOnly", true)

    // An existing endpoint's headers stay in the settings when you go on to create a new endpoint from it.
    await openExisting(page)
    await chooseEndpoint(page, keyed.name)
    await openPanel(page, "Create a new Search Endpoint")
    await openSection(page, "Advanced")
    await expect(page.locator("#wizardHeaderType")).toHaveValue("Custom")
    await expect(headers).toHaveValue(/X-Key/)
    await expect(headers).toHaveJSProperty("readOnly", false)
  })

  test("submits the case name and adds a query on Enter", async ({ page }) => {
    await stubEngine(page)
    await page.goto(`case/${caseId}/try/1?showWizard=true`)
    await expect(modal(page).getByRole("heading", { name: /Welcome To Quepid/i })).toBeVisible({
      timeout: 15_000
    })
    await next(page).click()
    const name = modal(page).getByLabel("New Case Name:")
    await name.evaluate((el: HTMLElement) => el.focus())
    await name.fill("Enter test", { force: true })
    await name.press("Enter")
    await expect(modal(page).getByRole("heading", { name: /What Search Endpoint/i })).toBeVisible()
    await openPanel(page, "Create a new Search Endpoint")
    await useStubbedSolr(page)
    await next(page).click()
    await expect(modal(page).getByRole("heading", { name: /How Should We Display/i })).toBeVisible({
      timeout: 20_000
    })
    await chooseTitleAndId(page)
    await next(page).click()
    const query = modal(page).getByPlaceholder("Search query")
    await query.fill("star wars")
    await query.press("Enter")
    await expect(
      modal(page).getByRole("heading", { name: /Add Your Search Queries/i })
    ).toBeVisible()
    await expect(field(page, "queryList")).toContainText("star wars")
  })

  test("deletes the draft case before opening the Mapper Wizard", async ({ page }) => {
    await toEndpointStep(page)
    await engine(page, "searchapi")
    await wizard(page).locator('[data-action="wizard#goToMapperWizard"]').click()
    await expect(page).toHaveURL(/\/search_endpoints\/mapper_wizard/, { timeout: 20_000 })
    const response = await page.request.get(`api/cases/${caseId}`, {
      headers: await apiHeaders(page)
    })
    expect(response.ok()).toBe(false)
    draftDeleted = true
  })

  test("keeps Continue disabled for a Static endpoint until its CSV is imported", async ({
    page
  }) => {
    await toEndpointStep(page)
    await engine(page, "static")
    const proceed = wizard(page).locator('[data-wizard-target~="endpointContinue"]')
    await expect(proceed).toBeDisabled()
    await expect(field(page, "staticFile")).toBeVisible()
    await expect(field(page, "searchUrl")).toBeHidden()

    const csv = "Query Text,Doc ID,Doc Position,title\nstar wars,1,1,Star Wars\n"
    await wizard(page)
      .locator('input[type="file"]')
      .setInputFiles({ name: "static.csv", mimeType: "text/csv", buffer: Buffer.from(csv) })
    // As in the Angular wizard, the file is shown under "CSV" and imported only on Import.
    const preview = when(page, "static-preview")
    await expect(preview.getByRole("heading", { name: "CSV" })).toBeVisible()
    await expect(field(page, "staticContent")).toHaveText(csv)
    await expect(proceed).toBeDisabled()
    const before = await page.request.get(`api/cases/${caseId}/snapshots`, {
      headers: await apiHeaders(page)
    })
    expect((await before.json()).snapshots).toHaveLength(0)

    await field(page, "staticImportButton").click()
    await expect(proceed).toBeEnabled({ timeout: 20_000 })
    await expect(field(page, "staticImportButton")).toBeDisabled()
    // Success is reported as status text, not in the wizard's error alert.
    await expect(field(page, "staticStatus")).toHaveText("Static data imported successfully.")
    await expect(field(page, "alert")).toBeHidden()
    const snapshots = await page.request.get(`api/cases/${caseId}/snapshots`, {
      headers: await apiHeaders(page)
    })
    expect((await snapshots.json()).snapshots).toHaveLength(1)
  })

  test("shows a static CSV with the wrong headers and does not let it be imported", async ({
    page
  }) => {
    await toEndpointStep(page)
    await engine(page, "static")
    await wizard(page)
      .locator('input[type="file"]')
      .setInputFiles({
        name: "bad.csv",
        mimeType: "text/csv",
        buffer: Buffer.from("Foo,Bar\n1,2\n")
      })
    await expect(field(page, "staticAlert")).toContainText("Required headers mismatch")
    await expect(field(page, "staticContent")).toHaveText("Foo,Bar\n1,2\n")
    await expect(field(page, "staticImportButton")).toBeDisabled()
    await expect(field(page, "alert")).toBeHidden()
  })

  test("shows URL and auth guidance only for engines that support it", async ({ page }) => {
    await toEndpointStep(page)
    await openPanel(page, "Create a new Search Endpoint")
    await openSection(page, "Advanced")
    await expect(field(page, "urlFormat")).toHaveText(
      "http(s?)://yourdomain.com:8983/<index>/select"
    )
    await expect(field(page, "basicAuth")).toBeVisible()
    for (const name of ["algolia", "vectara"]) {
      await engine(page, name)
      await expect(field(page, "basicAuth")).toBeHidden()
    }
    await engine(page, "solr")
    await expect(field(page, "basicAuth")).toBeVisible()
  })

  test("offers the API method only for Solr", async ({ page }) => {
    await toEndpointStep(page)
    const apiMethod = page.locator("#wizardApiMethod")
    await openSection(page, "Solr Configuration")
    await expect(apiMethod).toBeVisible()
    await expect(apiMethod.locator("option")).toHaveText(["JSONP", "GET"])
    for (const name of ["es", "os", "vectara", "algolia", "searchapi"]) {
      await engine(page, name)
      await expect(apiMethod, name).toBeHidden()
    }
    await engine(page, "solr")
    await expect(apiMethod).toBeVisible()
  })

  test("uses the Legacy frame: a close button, no title bar or Cancel, and step dots along the bottom", async ({
    page
  }) => {
    await toEndpointStep(page)
    await expect(wizard(page).locator(".modal-header")).toHaveCount(0)
    await expect(wizard(page).locator(".modal-footer")).toHaveCount(0)
    await expect(wizard(page).getByRole("button", { name: "Cancel", exact: true })).toHaveCount(0)
    await expect(wizard(page).getByRole("button", { name: "Close" })).toBeVisible()
    const steps = wizard(page).locator(".wizard-steps .wizard-step")
    await expect(steps).toHaveText(["Welcome", "Name", "Endpoint", "Fields", "Query", "Finish"])
    for (const [index, state] of [
      [0, "done"],
      [1, "done"],
      [2, "active"]
    ] as const)
      await expect(steps.nth(index)).toHaveClass(new RegExp(state))
    await expect(steps.nth(3)).toBeDisabled()
    // The dots sit below the step content.
    const stepsBox = (await wizard(page).locator(".wizard-steps").boundingBox())!
    const headingBox = (await modal(page)
      .getByRole("heading", { name: /What Search Endpoint/i })
      .boundingBox())!
    expect(stepsBox.y).toBeGreaterThan(headingBox.y)
    // A completed step's dot goes back to it.
    await steps.nth(1).click()
    await expect(modal(page).getByRole("heading", { name: /Name Your Case/i })).toBeVisible()
  })

  test("starts with both endpoint panels closed, and opening one closes the other", async ({
    page
  }) => {
    const existing = await createEndpoint(page, {})
    await page.goto(`case/${caseId}/try/1?showWizard=true`)
    await expect(modal(page).getByRole("heading", { name: /Welcome To Quepid/i })).toBeVisible({
      timeout: 15_000
    })
    await next(page).click()
    await modal(page).getByLabel("New Case Name:").fill("Accordion test", { force: true })
    await next(page).click()
    const create = panel(page, "Create a new Search Endpoint")
    const use = panel(page, "Use an existing Search Endpoint")
    await expect(create).not.toHaveAttribute("open")
    await expect(use).not.toHaveAttribute("open")
    await expect(field(page, "searchUrl")).toBeHidden()
    await expect(page.locator("#wizardEndpoint + .ts-wrapper")).toBeHidden()
    await expect(wizard(page).locator('[data-wizard-target~="endpointContinue"]')).toBeHidden()

    await use.locator("> summary").click()
    await expect(page.locator("#wizardEndpoint + .ts-wrapper")).toBeVisible()
    const proceed = wizard(page).locator('[data-wizard-target~="endpointContinue"]')
    const usePing = use.getByRole("button", { name: "ping it" })
    await expect(proceed).toBeDisabled()
    await expect(usePing).toBeDisabled()
    await chooseEndpoint(page, existing.name)
    await expect(proceed).toBeEnabled()
    await expect(usePing).toBeEnabled()

    // Opening Create closes the existing panel and drops the chosen endpoint.
    await create.locator("> summary").click()
    await expect(use).not.toHaveAttribute("open")
    await expect(field(page, "searchUrl")).toBeVisible()
    await use.locator("> summary").click()
    await expect(page.locator("#wizardEndpoint")).toHaveValue("")
    await expect(proceed).toBeDisabled()
  })

  test("keeps Solr Configuration and Advanced collapsed until opened", async ({ page }) => {
    await toEndpointStep(page)
    await expect(field(page, "searchUrl")).toBeVisible()
    for (const [name, control] of [
      ["Solr Configuration", "#wizardApiMethod"],
      ["Advanced", "#wizardHeaderType"]
    ]) {
      await expect(section(page, name).locator("summary")).toBeVisible()
      await expect(page.locator(control)).toBeHidden()
      await section(page, name).locator("summary").click()
      await expect(page.locator(control)).toBeVisible()
    }
  })

  test("fills the Solr curl command and troubleshooting links from the entered settings", async ({
    page
  }) => {
    await toEndpointStep(page)
    await field(page, "searchUrl").fill(ENGINE_URL)
    await openSection(page, "Advanced")
    await field(page, "basicAuth").fill("u:p")
    await page.locator("#wizardProxy").check({ force: true })
    await expect(field(page, "curlAuth")).toHaveText("-u u:p ")
    await expect(field(page, "endpointLink").first()).toHaveAttribute(
      "href",
      /\/proxy\/fetch\?url=http:\/\/wizard\.invalid\/solr\/tmdb\/select$/
    )
    await expect(field(page, "wikiLink").first()).toHaveAttribute("href", /^https?:\/\//)
  })

  test("adds a clicked discovered field once, and filters suggestions while preserving modifiers", async ({
    page
  }) => {
    await stubEngine(page)
    await toFieldsStep(page)
    await chooseTitleAndId(page)
    const fields = page.locator("#wizardAdditionalFields")
    const wrapper = page.locator("#wizardAdditionalFields + .ts-wrapper")
    const input = page.locator("#wizardAdditionalFields-ts-control")
    const options = page.locator("#wizardAdditionalFields-ts-dropdown .option")
    await wrapper.locator(".ts-control").click()
    await expect(options).toHaveCount(4)
    expect((await options.allInnerTexts()).sort()).toEqual(["body", "cast", "poster_path", "year"])
    await options.filter({ hasText: /^year$/ }).click()
    await expect(fields).toHaveValue("year")
    await wrapper.locator('.item[data-value="year"] .remove').click()
    await input.fill("cast")
    await options.filter({ hasText: /^cast$/ }).click()
    await input.fill("thumb:pos")
    await expect(options).toHaveText(["thumb:poster_path"])
    await options.first().click()
    await expect(fields).toHaveValue("cast,thumb:poster_path")
    await expect(wrapper.locator(".item")).toHaveText(["cast×", "thumb:poster_path×"])
    await input.fill("custom_field")
    await page.keyboard.press("Tab")
    await expect(fields).toHaveValue("cast,thumb:poster_path")
    await expect(wrapper.locator(".item")).toHaveCount(2)
  })

  test("keeps Finish disabled while queries and onboarding save, then closes the wizard", async ({
    page
  }) => {
    await stubEngine(page)
    await toFieldsStep(page)
    await addQueryAndFinish(page)
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route(`**/api/bulk/cases/${caseId}/queries`, async (route) => {
      await gate
      await route.continue()
    })
    const finish = field(page, "finishButton")
    await finish.click()
    await expect(finish).toBeDisabled()
    await expect(modal(page)).toBeVisible()
    release()
    await expect(page.locator(".modal.show")).toHaveCount(0, { timeout: 30_000 })
    await expect(page.getByText("star wars", { exact: false }).first()).toBeVisible({
      timeout: 15_000
    })
  })

  test("keeps the wizard open after a failed query save, and Finish can retry", async ({
    page
  }) => {
    await stubEngine(page)
    await toFieldsStep(page)
    await addQueryAndFinish(page)
    const failing = (route: Route) =>
      route.fulfill({ status: 500, json: { error: "query save failed" } })
    await page.route(`**/api/bulk/cases/${caseId}/queries`, failing)
    const finish = field(page, "finishButton")
    await finish.click()
    await expect(alert(page).first()).toBeVisible({ timeout: 20_000 })
    await expect(finish).toBeEnabled()
    await expect(modal(page)).toBeVisible()

    await page.unroute(`**/api/bulk/cases/${caseId}/queries`, failing)
    await finish.click()
    await expect(page.locator(".modal.show")).toHaveCount(0, { timeout: 30_000 })
  })
})
