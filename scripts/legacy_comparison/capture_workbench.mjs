/**
 * Captures the core workbench and annotation differences on Legacy and Current for side-by-side
 * comparison: B1–B6 (core workbench behaviour changes, now decided in docs/todo/NOT-DOING.md or
 * restored) and A1–A5 ("Annotation list display changes"). Everything runs on a clone of
 * the sample-data case "10s of Queries" and an empty scratch case, both deleted afterwards. Flash
 * text and native dialog messages go to notes-<side>.json.
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
  "Usage: node scripts/legacy_comparison/capture_workbench.mjs [--out tmp/legacy_comparison] [--sides legacy,current]"
const SOURCE_CASE = "10s of Queries"
const HTTP_SOLR = "http://quepid-solr.dev.o19s.com:8985/solr/tmdb/select"
// B2: a media URL whose extension is followed by a fragment, swapped into each query's first result.
const FRAGMENT_MEDIA = "https://example.org/clip.mp3#t=5"

const { out, sides } = parseCaptureArgs(USAGE)

async function newTry(page, caseId, parentTryNumber, fieldSpec) {
  const response = await page.request.post(`/api/cases/${caseId}/tries`, {
    headers: await apiHeaders(page),
    data: {
      parent_try_number: parentTryNumber,
      try: {
        query_params: "q=#$query##",
        field_spec: fieldSpec,
        number_of_rows: 3,
        escape_query: true
      },
      search_endpoint: { search_engine: "solr", endpoint_url: HTTP_SOLR, api_method: "JSONP" }
    }
  })
  if (!response.ok()) throw new Error(`POST tries: ${await response.text()}`)
  return response.json()
}

async function createCase(page, name) {
  const response = await page.request.post("/api/cases", {
    headers: await apiHeaders(page),
    data: { case: { case_name: name } }
  })
  if (!response.ok()) throw new Error(`POST cases: ${await response.text()}`)
  return (await response.json()).case_id
}

const csv = (name, body) => ({ name, mimeType: "text/csv", buffer: Buffer.from(body) })

const browser = await chromium.launch()
for (const side of sides) {
  const legacy = isLegacy(side)
  const page = await openSide(browser, side)
  await page.setViewportSize({ width: 1400, height: 1250 })
  const shot = shots(page, out, side)
  const pane = page.locator(".pane_east")
  const modal = () => page.locator(legacy ? ".modal:visible" : ".modal.show").last()
  const modalShot = (name) =>
    modal()
      .locator(legacy ? ".modal-dialog" : ".modal-dialog")
      .first()
      .screenshot({ path: join(out, `${name}-${side}.png`) })
  const flash = async () =>
    (
      await page
        .locator('#flash-messages, .flash, [class*="alert"]')
        .filter({ visible: true })
        .allInnerTexts()
    )
      .map((text) => text.trim())
      .filter(Boolean)
  const notes = {}
  const scratch = []
  const endpoints = []
  const existingEndpoints = await existingSearchEndpointIds(page)
  const step = async (name, fn) => {
    try {
      await fn()
    } catch (error) {
      console.error(`${side} ${name}: ${error.message.split("\n")[0]}`)
      await page.screenshot({ path: join(out, `error-${name}-${side}.png`) }).catch(() => {})
      await page.keyboard.press("Escape").catch(() => {})
    }
  }
  const openCase = async (id, tryNumber) => {
    await page.goto(tryNumber ? `/case/${id}/try/${tryNumber}` : `/case/${id}`)
    await page.waitForTimeout(6000)
  }
  const expandFirstQuery = async () => {
    await page.locator(".toggleSign").filter({ visible: true }).first().click()
    await page.locator("search-result").first().waitFor({ timeout: 15000 })
    await page.waitForTimeout(1500)
  }
  const openDrawer = async () => {
    await page
      .getByText("Tune Relevance", { exact: true })
      .filter({ visible: true })
      .first()
      .click()
    await page.waitForTimeout(1500)
  }
  const annotationsTab = async () => {
    await page
      .locator(legacy ? "#annotationsTab" : 'button[data-tune-relevance-tab-param="annotations"]')
      .first()
      .click()
    await page.waitForTimeout(1000)
  }

  try {
    const source = await findCase(page, SOURCE_CASE)
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
    const cloneId = (await cloned.json()).case_id
    scratch.push(cloneId)

    // B1: a case id that doesn't exist.
    await step("b1", async () => {
      await page.goto("/case/987654321")
      await page.waitForTimeout(5000)
      await shot.full("b1")
      notes.b1 = await flash()
    })

    await openCase(cloneId)

    // B3: Query Options with no options, then invalid JSON.
    await step("b3", async () => {
      await expandFirstQuery()
      await page
        .getByRole("button", { name: "Set Options", exact: true })
        .filter({ visible: true })
        .first()
        .click()
      await page.waitForTimeout(1200)
      await outline(modal().locator(legacy ? ".ace_editor" : ".cm-editor"))
      await modalShot("b3a")
      await clearOutlines(page)
      await modal()
        .locator(legacy ? ".ace_content" : ".cm-content")
        .first()
        .click()
      await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A")
      await page.keyboard.insertText('{"bad": ')
      await modal().getByRole("button", { name: "Set Options", exact: true }).click()
      await page.waitForTimeout(1500)
      notes.b3 = await flash()
      await shot.full("b3b")
      if (await page.locator(".modal:visible").count()) {
        await page
          .locator(".modal:visible")
          .last()
          .getByRole("button", { name: "Cancel", exact: true })
          .click()
        await page.waitForTimeout(800)
      }
    })

    // B4: the Matches popover, then Debug over it, then the popover after Debug closes.
    await step("b4", async () => {
      const matches = page.locator(".matches-popper").filter({ visible: true }).first()
      await matches.scrollIntoViewIfNeeded()
      await matches.click()
      await page.waitForTimeout(1000)
      await outline(page.locator(".popover:visible"))
      await shot.full("b4a")
      await clearOutlines(page)
      await page.locator(".popover:visible").getByText("Debug", { exact: true }).first().click()
      await page.waitForTimeout(1500)
      await shot.full("b4b")
      await page.keyboard.press("Escape")
      await page.waitForTimeout(1000)
      await outline(page.locator(".popover:visible"))
      await shot.full("b4c")
      await clearOutlines(page)
      notes.b4 = { popoverOpenAfterDebug: await page.locator(".popover:visible").count() }
      await page.mouse.click(5, 300)
      await page.waitForTimeout(500)
    })

    // B5: the Import modal's CSV chooser, then a CSV whose rows don't match the header.
    await step("b5", async () => {
      await page.getByText("Import", { exact: true }).filter({ visible: true }).first().click()
      await page.waitForTimeout(1200)
      await modal().locator("input[type=radio][value=csv]").check()
      const chooser = legacy
        ? modal().locator(".ng-csv-import").first()
        : modal().locator("input[type=file]").first()
      await outline(chooser)
      await modalShot("b5a")
      await chooser.locator("xpath=..").screenshot({ path: join(out, `b5c-${side}.png`) })
      await clearOutlines(page)
      const input = legacy
        ? modal().locator(".ng-csv-import input[type=file]").first()
        : modal().locator("input[type=file]").first()
      await input.setInputFiles(
        csv("ragged.csv", "query,docid,rating\nstar wars,3574597,3,extra\nstar trek,1\n")
      )
      await page.waitForTimeout(1500)
      await outline(
        modal().locator(legacy ? ".import-content" : '[data-import-ratings-core-target="alert"]')
      )
      await modalShot("b5b")
      await clearOutlines(page)
      notes.b5 = await modal()
        .locator(legacy ? ".import-content" : '[data-import-ratings-core-target="alert"]')
        .allInnerTexts()
    })

    // B6: an information-needs import that fails.
    await step("b6", async () => {
      // A fresh modal: Legacy silently skips every import while B5's CSV alert is still set.
      await page.reload()
      await page.waitForTimeout(6000)
      await page.getByText("Import", { exact: true }).filter({ visible: true }).first().click()
      await page.waitForTimeout(1200)
      await modal().getByText("Information Needs", { exact: true }).first().click()
      await page.waitForTimeout(500)
      await modal().locator("input[type=radio][value=information_needs]").check()
      const input = legacy
        ? modal().locator(".ng-csv-import input[type=file]").filter({ visible: true }).first()
        : modal().locator("input[type=file]").filter({ visible: true }).first()
      await input.setInputFiles(csv("needs.csv", 'query,information_need\nnot in this case,"x"\n'))
      await page.waitForTimeout(1000)
      await modal().getByRole("button", { name: "Import", exact: true }).click()
      await page.waitForTimeout(2500)
      notes.b6 = { flash: await flash(), modalOpen: await page.locator(".modal:visible").count() }
      await shot.full("b6")
      if (await page.locator(".modal:visible").count()) await page.keyboard.press("Escape")
      await page.waitForTimeout(800)
    })

    // A1–A3, A5: an annotation on the clone, its list entry, and the Edit modal.
    await step("a1", async () => {
      await openCase(cloneId)
      await openDrawer()
      await annotationsTab()
      await pane.locator("textarea").filter({ visible: true }).first().fill("Parity annotation")
      await pane.getByRole("button", { name: "Create", exact: true }).click()
      await page.waitForTimeout(2500)
      const item = pane
        .locator("li.annotation, annotation li, .annotations li")
        .filter({ hasText: "Parity annotation" })
        .first()
      await item.scrollIntoViewIfNeeded()
      await outline(item)
      await item.screenshot({ path: join(out, `a1-${side}.png`) })
      await pane.screenshot({ path: join(out, `a1p-${side}.png`) })
      notes.a1 = await item.innerText()
      await clearOutlines(page)
      await page.reload()
      await page.waitForTimeout(6000)
      await openDrawer()
      await annotationsTab()
      const reloaded = pane
        .locator("li.annotation, annotation li, .annotations li")
        .filter({ hasText: "Parity annotation" })
        .first()
      await reloaded.scrollIntoViewIfNeeded()
      await reloaded.screenshot({ path: join(out, `a1r-${side}.png`) })
      notes.a1Reloaded = await reloaded.innerText()
      await reloaded.locator(".dropdown-toggle").first().click()
      await page.waitForTimeout(400)
      await reloaded.getByText("Edit", { exact: true }).first().click()
      await page.waitForTimeout(1200)
      await outline(modal().locator(".modal-footer"))
      await modalShot("a5")
      await clearOutlines(page)
      await modal().getByRole("button", { name: "Cancel", exact: true }).click()
      await page.waitForTimeout(600)
    })

    // A4: the Annotations tab on a case with no queries, and clicking Create there.
    await step("a4", async () => {
      const emptyId = await createCase(page, `Legacy comparison empty ${Date.now()}`)
      scratch.push(emptyId)
      await openCase(emptyId)
      await openDrawer()
      await annotationsTab()
      await outline(
        pane.getByRole("button", { name: "Create", exact: true }),
        pane.getByText("No annotations yet.")
      )
      await pane.screenshot({ path: join(out, `a4a-${side}.png`) })
      await clearOutlines(page)
      await pane
        .getByRole("button", { name: "Create", exact: true })
        .click({ force: true, timeout: 3000 })
        .catch(() => {})
      await page.waitForTimeout(1200)
      notes.a4 = await flash()
      await shot.full("a4b")
    })

    // B2: media fields, with each query's first result pointing at a URL with a fragment.
    await step("b2", async () => {
      const mediaCase = await createCase(page, `Legacy comparison media ${Date.now()}`)
      scratch.push(mediaCase)
      const query = await page.request.post(`/api/cases/${mediaCase}/queries`, {
        headers: await apiHeaders(page),
        data: { query: { query_text: "star wars" } }
      })
      if (!query.ok()) throw new Error(`POST queries: ${await query.text()}`)
      const media = await newTry(
        page,
        mediaCase,
        1,
        "id:id title:title media:poster_path media:overview"
      )
      endpoints.push(media.search_endpoint_id)
      await page.route(
        (url) => url.href.includes("tmdb/select"),
        async (route) => {
          const response = await route.fetch()
          const body = (await response.text()).replace(
            /("poster_path"\s*:\s*")[^"]*"/,
            `$1${FRAGMENT_MEDIA}"`
          )
          await route.fulfill({ response, body })
        }
      )
      await openCase(mediaCase, media.try_number)
      await expandFirstQuery()
      const results = page.locator("search-result").filter({ visible: true })
      await outline(
        page.locator(".media-embed:visible"),
        page.locator("li:visible").filter({ hasText: /^overview:/ })
      )
      await results.first().screenshot({ path: join(out, `b2a-${side}.png`) })
      await results.nth(1).screenshot({ path: join(out, `b2b-${side}.png`) })
      await clearOutlines(page)
      await page.unrouteAll()
    })
  } catch (error) {
    console.error(`${side}: ${error.message.split("\n")[0]}`)
    await shot.full("error-workbench")
  }

  notes.dialogs = page.dialogs
  writeFileSync(join(out, `notes-workbench-${side}.json`), JSON.stringify(notes, null, 2))
  await page.goto("/cases")
  for (const id of scratch) await deleteCase(page, id)
  for (const id of endpoints.filter(Boolean))
    await deleteSearchEndpoint(page, id, existingEndpoints)
  await page.context().close()
}
await browser.close()
console.log(`Screenshots in ${out}`)
