/**
 * Captures the Tune Relevance drawer on Legacy and Current for side-by-side comparison (T1–T14 of
 * the 2026-10-17 parity review). The first captures read the sample-data case "10s of Queries"
 * without changing it; the rest run on a clone with extra tries, deleted afterwards. Hover text and
 * native dialog messages, which a screenshot can't show, are written to notes-<side>.json.
 */
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import {
  apiHeaders,
  chromium,
  clearOutlines,
  deleteCase,
  deleteSearchEndpoint,
  existingSearchEndpointIds,
  findCase,
  isLegacy,
  openSide,
  outline,
  parseCaptureArgs,
  shots
} from "./lib.mjs"

const USAGE =
  "Usage: node scripts/legacy_comparison/capture_tune_relevance.mjs [--out tmp/legacy_comparison] [--sides legacy,current]"
const SOURCE_CASE = "10s of Queries"
const HTTP_SOLR = "http://quepid-solr.dev.o19s.com:8985/solr/tmdb/select"
const HTTPS_SOLR = "https://quepid-solr.dev.o19s.com:8985/solr/tmdb/select"
const LEGACY_TABS = {
  curator: "#curatorTab",
  engineSettings: "#engineTab",
  history: "#historyTab",
  annotations: "#annotationsTab"
}

const { out, sides } = parseCaptureArgs(USAGE)

async function newTry(page, caseId, parentTryNumber, queryParams, endpointUrl, curatorVars) {
  const response = await page.request.post(`/api/cases/${caseId}/tries`, {
    headers: await apiHeaders(page),
    data: {
      parent_try_number: parentTryNumber,
      try: {
        query_params: queryParams,
        field_spec: "id:id title:title",
        number_of_rows: 10,
        escape_query: true
      },
      search_endpoint: { search_engine: "solr", endpoint_url: endpointUrl, api_method: "JSONP" },
      curator_vars: curatorVars
    }
  })
  if (!response.ok()) throw new Error(`POST tries: ${await response.text()}`)
  return response.json()
}

const browser = await chromium.launch()
for (const side of sides) {
  const legacy = isLegacy(side)
  const page = await openSide(browser, side)
  await page.setViewportSize({ width: 1400, height: 1300 })
  const shot = shots(page, out, side)
  const pane = page.locator(".pane_east")
  const notes = {}
  const openDrawer = async () => {
    await page
      .getByText("Tune Relevance", { exact: true })
      .filter({ visible: true })
      .first()
      .click()
    await page.waitForTimeout(1500)
  }
  const tab = async (name) => {
    await page
      .locator(legacy ? LEGACY_TABS[name] : `button[data-tune-relevance-tab-param="${name}"]`)
      .first()
      .click()
    await page.waitForTimeout(800)
  }
  const expand = async (name) => {
    const header = pane.locator(".dev-header:visible").filter({ hasText: name }).first()
    if (
      !(await header
        .locator("xpath=following-sibling::*[1]")
        .isVisible()
        .catch(() => false))
    )
      await header.click()
    await page.waitForTimeout(300)
  }
  let cloneId = null
  const endpoints = []
  const existingEndpoints = await existingSearchEndpointIds(page)

  try {
    const source = await findCase(page, SOURCE_CASE)
    await page.goto(`/case/${source.id}`)
    await page.waitForTimeout(5000)
    await openDrawer()

    // T1: the Tuning Knobs empty state.
    await tab("curator")
    await outline(
      legacy
        ? pane.locator("p:visible").filter({ hasText: "What's this tab do?" })
        : page.locator('[data-tune-relevance-target="knobsIntro"]'),
      pane.locator(".tip:visible")
    )
    await shot.pane("t1")
    await clearOutlines(page)

    // T11: the Annotations intro.
    await tab("annotations")
    await outline(
      pane
        .locator("p:visible")
        .filter({ hasText: /Annotations are like snapshots|You might have made/ }),
      pane.locator(':text("No annotations yet.")')
    )
    await shot.pane("t11")
    await clearOutlines(page)

    // T2 and T3: Settings help badges and section order.
    await tab("engineSettings")
    for (const name of ["Evaluate Nightly", "Escape Queries", "Search Endpoints"])
      await expand(name)
    const help = page.locator(legacy ? ".pane_east .label-info:visible" : ".setting-help:visible")
    await outline(help)
    await help.first().hover()
    await page.waitForTimeout(700)
    await shot.pane("t2")
    await page.mouse.move(5, 5)
    await clearOutlines(page)
    await outline(
      pane
        .locator(".dev-header:visible")
        .filter({ hasText: /Evaluate Nightly|Escape Queries|Search Endpoints/ })
    )
    await shot.pane("t3")
    await clearOutlines(page)

    // T13: endpoint suggestions; T4: no match.
    const search = page.locator('input[placeholder="Select endpoint to use"]:visible').first()
    await search.fill("")
    await search.evaluate((element) => element.blur())
    await search.click()
    await search.press("ArrowDown").catch(() => {})
    await page.waitForTimeout(1000)
    await outline(
      page.locator(
        legacy ? "ul.dropdown-menu:visible" : '[data-tune-relevance-target="endpointSuggestions"]'
      )
    )
    await shot.pane("t13")
    await clearOutlines(page)
    await search.fill("zzzz")
    await page.waitForTimeout(1000)
    await outline(
      pane
        .getByText(/No search endpoints found|No matching search endpoints/)
        .filter({ visible: true }),
      pane.getByText("Pick Shared Endpoints:").filter({ visible: true })
    )
    await shot.pane("t4")
    await clearOutlines(page)
    await search.fill("")
    await search.evaluate((element) => element.blur())

    // The rest run on a clone, which isn't shared with a team.
    const cloned = await page.request.post("/api/clone/cases", {
      headers: await apiHeaders(page),
      data: {
        case_id: source.id,
        case_name: `Legacy comparison scratch ${Date.now()}`,
        clone_queries: true,
        clone_ratings: true,
        preserve_history: false,
        try_number: source.lastTryNumber
      }
    })
    cloneId = (await cloned.json()).case_id
    const knobTry = await newTry(
      page,
      cloneId,
      1,
      "q=#$query##&defType=edismax&qf=title^##titleBoost##",
      HTTP_SOLR,
      { titleBoost: 1 }
    )
    await page.goto(`/case/${cloneId}/try/${knobTry.try_number}`)
    await page.waitForTimeout(5000)
    await openDrawer()

    // T14: a long knob value.
    await tab("curator")
    const knob = pane.locator('input[type="number"]:visible').first()
    await knob.fill("123456789012345")
    await outline(knob)
    await shot.pane("t14")
    await clearOutlines(page)

    // T9: history shading; T10: history hover text.
    await tab("history")
    await outline(page.locator(".history-list li:visible"))
    await shot.pane("t9")
    await clearOutlines(page)
    notes.t10 = await page
      .locator(".history-list li:visible")
      .evaluateAll((items) => items.map((item) => item.title))

    // T4: the empty endpoint list.
    await tab("engineSettings")
    await expand("Search Endpoints")
    await outline(
      pane
        .getByText(/You do not have any search endpoints|No search endpoints found\. Create/)
        .filter({ visible: true }),
      pane.getByText("Pick Shared Endpoints:").filter({ visible: true })
    )
    await shot.pane("t4b")
    await clearOutlines(page)

    // T7: renaming a try.
    await tab("history")
    const row = page.locator(".history-list li:visible").last()
    await row.hover()
    await row.locator(".try-details").click()
    await page.waitForTimeout(1200)
    const details = page.locator(".modal:visible").last()
    await details.getByRole("button", { name: "Rename", exact: true }).click()
    await page.waitForTimeout(400)
    await details.locator('input[type="text"]:visible').first().fill("Renamed try")
    await details
      .locator('form :is(input[type="submit"], button[type="submit"]):visible')
      .first()
      .click()
    await page.waitForTimeout(2000)
    if (await details.isVisible())
      await outline(details.getByText("Renamed try", { exact: false }).first())
    await outline(
      page.locator("#flash-messages .alert:visible, .flash:visible").filter({ hasText: /renamed/i })
    )
    await shot.full("t7")
    await clearOutlines(page)

    // T8: deleting a try (the confirmation is a native dialog, so its text goes to the notes).
    if (!(await page.locator(".modal:visible").count())) {
      const last = page.locator(".history-list li:visible").last()
      await last.hover()
      await last.locator(".try-details").click()
      await page.waitForTimeout(1000)
    }
    await page
      .locator(".modal:visible")
      .last()
      .getByRole("button", { name: "Delete", exact: true })
      .click()
    await page.waitForTimeout(2000)
    notes.t8 = page.dialogs.slice()

    // T12: the toolbar on a try whose endpoint uses the other protocol; T5: its explanation.
    const httpsTry = await newTry(page, cloneId, knobTry.try_number, "q=#$query##", HTTPS_SOLR, {})
    endpoints.push(httpsTry.search_endpoint_id)
    await page.setViewportSize({ width: 1400, height: 900 })
    await page.goto(`/case/${cloneId}/try/${httpsTry.try_number}`)
    await page.waitForTimeout(7000)
    for (const name of [
      "Select scorer",
      "Judgements",
      "Create snapshot",
      "Clone",
      "Export",
      "Tune Relevance"
    ]) {
      await outline(page.getByText(name, { exact: true }).filter({ visible: true }).first())
    }
    await shot.full("t12")
    await clearOutlines(page)
    await page.setViewportSize({ width: 1400, height: 1300 })
    await openDrawer()
    await tab("engineSettings")
    await outline(
      pane.getByText(/different protocol/).filter({ visible: true }),
      pane.getByText(/Reload Quepid in/).filter({ visible: true })
    )
    await shot.pane("t5")
    await clearOutlines(page)
  } catch (error) {
    console.error(`${side}: ${error.message.split("\n")[0]}`)
    await shot.full("error-tune")
  }

  writeFileSync(join(out, `notes-${side}.json`), JSON.stringify(notes, null, 2))
  await page.goto("/cases")
  if (cloneId) await deleteCase(page, cloneId)
  for (const id of endpoints.filter(Boolean))
    await deleteSearchEndpoint(page, id, existingEndpoints)
  await page.context().close()
}
await browser.close()
console.log(`Screenshots in ${out}`)
