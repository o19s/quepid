/**
 * Captures the case wizard on Legacy and Current for side-by-side comparison: the Endpoint step on
 * arrival (W3), an existing Search API endpoint's Endpoint and Query steps (W1), the Query step with
 * an added query, and the static CSV preview and import (W2). Each run creates draft cases through
 * /cases/new and deletes them afterwards.
 */
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  chromium,
  clearOutlines,
  deleteCase,
  isLegacy,
  openSide,
  outline,
  parseCaptureArgs,
  shots
} from "./lib.mjs"

const USAGE =
  "Usage: node scripts/legacy_comparison/capture_wizard.mjs [--out tmp/legacy_comparison] [--sides legacy,current]"
const SEARCH_API_ENDPOINT = "Edinburgh University Website"
const STATIC_CSV = [
  "Query Text,Doc ID,Doc Position,MovieTitle",
  "star wars,527641,1,Star Wars",
  "star wars,9426,2,Star Wars: The Empire Strikes Back",
  "alien,348,1,Alien"
].join("\n")

const { out, sides } = parseCaptureArgs(USAGE)
const csvPath = join(mkdtempSync(join(tmpdir(), "legacy-comparison-")), "static.csv")
writeFileSync(csvPath, STATIC_CSV)

const browser = await chromium.launch()
for (const side of sides) {
  const legacy = isLegacy(side)
  const page = await openSide(browser, side)
  await page.setViewportSize({ width: 1400, height: 1500 })
  const shot = shots(page, out, side)
  const wizard = legacy ? page.locator(".modal") : page.locator("#wizardModal")
  const cont = async () => {
    await (
      legacy
        ? page.locator(".modal button.continue:visible")
        : wizard.locator("button:visible", { hasText: /^\s*Continue/ })
    )
      .first()
      .click()
    await page.waitForTimeout(2500)
  }
  const openPanel = async (name) => {
    await (
      legacy
        ? wizard.getByText(name, { exact: true })
        : wizard.locator("summary", { hasText: name })
    ).click()
    await page.waitForTimeout(800)
  }
  const cases = []
  // /cases/new creates a draft case and opens the wizard on it.
  const startWizard = async () => {
    await page.goto("/cases/new")
    await page.waitForTimeout(6000)
    cases.push(Number((page.url().match(/case\/(\d+)/) || [])[1]) || null)
    if (
      await page
        .locator(".modal:visible")
        .getByText(/Welcome To Quepid/i)
        .isVisible()
        .catch(() => false)
    )
      await cont()
    await (
      legacy
        ? wizard.locator('input[ng-model="pendingWizardSettings.caseName"]')
        : page.locator("#wizardCaseName")
    ).fill("Legacy comparison scratch")
    await cont()
  }

  try {
    // W3: the Endpoint step on arrival.
    await startWizard()
    await outline(
      legacy
        ? page.locator(".modal .panel-heading:visible")
        : wizard.locator("details > summary:visible")
    )
    await shot.wizard("w3")
    await clearOutlines(page)

    // W1: an existing Search API endpoint, then its Query step.
    await openPanel("Use an existing Search Endpoint")
    const select = legacy
      ? wizard.locator("select#searchEndpoint")
      : page.locator("#wizardEndpoint")
    await select.selectOption(
      await select.locator("option", { hasText: SEARCH_API_ENDPOINT }).first().getAttribute("value")
    )
    await page.waitForTimeout(1200)
    await outline(
      legacy
        ? page.locator(".modal .well:visible")
        : wizard.locator('[data-wizard-when="selected-searchapi"]:visible')
    )
    await shot.wizard("w1a")
    await clearOutlines(page)
    if (legacy) {
      await page.locator(".modal .panel-collapse.in button.continue:visible").first().click()
      await page.waitForTimeout(6000)
      await wizard.locator('input[ng-model="pendingWizardSettings.titleField"]').fill("title")
      await wizard.locator('input[ng-model="pendingWizardSettings.idField"]').fill("id")
    } else {
      await cont()
      await page.waitForTimeout(3000)
      await page.locator("#wizardTitleField").fill("title")
      await page.locator("#wizardIdField").fill("id")
    }
    await cont()
    await outline(
      legacy
        ? page.locator(".modal .well:visible")
        : wizard.locator('section:visible [data-wizard-when="searchapi"]:visible')
    )
    await shot.wizard("w1b")
    await clearOutlines(page)

    // The Query step with one query added.
    await (
      legacy
        ? wizard.locator('input[ng-model="pendingWizardSettings.text"]')
        : wizard.getByPlaceholder("Search query")
    ).fill("star wars")
    await (
      legacy
        ? wizard.locator('input[value="Add Query"]')
        : wizard.getByRole("button", { name: "Add Query", exact: true })
    ).click()
    await page.waitForTimeout(800)
    await shot.wizard("query")

    // W2: a static CSV, on a fresh draft.
    await startWizard()
    await openPanel("Create a new Search Endpoint")
    if (legacy) {
      await wizard.locator("input[type=radio][value=static]").check()
      await page.waitForTimeout(800)
      // Legacy's Static Dataset toggle doesn't respond to a click here, so open it through its scope.
      await wizard.locator("button:visible", { hasText: "Static Dataset" }).evaluate((element) => {
        // eslint-disable-next-line no-undef
        const scope = window.angular.element(element).scope()
        scope.$apply(() => {
          scope.isStaticCollapsed = true
        })
      })
      await page.waitForTimeout(1200)
      await wizard.locator("input[type=file]").first().setInputFiles(csvPath)
      await page.waitForTimeout(2000)
      await outline(page.locator(".modal div.block:visible"))
      await shot.wizard("w2")
      await clearOutlines(page)
    } else {
      await wizard.locator("input[name=wizardEngine][value=static]").check({ force: true })
      await page.waitForTimeout(800)
      await wizard.locator("summary", { hasText: "Static Dataset" }).click()
      await page.locator("#wizardStaticFile").setInputFiles(csvPath)
      await page.waitForTimeout(1500)
      await outline(wizard.locator('[data-wizard-when="static-preview"]'))
      await shot.wizard("w2")
      await clearOutlines(page)
      await page.locator('[data-wizard-target="staticImportButton"]').click()
      await page.waitForTimeout(4000)
      await outline(
        page.locator('[data-wizard-target="staticStatus"]'),
        page.locator('[data-wizard-target="staticImportButton"]')
      )
      await shot.wizard("w2b")
      await clearOutlines(page)
    }
  } catch (error) {
    console.error(`${side}: ${error.message.split("\n")[0]}`)
    await shot.full("error-wizard")
  }

  await page.goto("/cases")
  for (const id of cases.filter(Boolean)) await deleteCase(page, id)
  await page.context().close()
}
await browser.close()
console.log(`Screenshots in ${out}`)
