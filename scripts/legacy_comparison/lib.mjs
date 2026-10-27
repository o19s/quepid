/**
 * Shared helpers for capturing the same state on Legacy (the historical instance, :3001) and
 * Current (:3000), with the parts that differ outlined. See docs/legacy_comparison.md.
 */
/* global document */
import { createRequire } from "node:module"
import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { parseArgs } from "node:util"

const require = createRequire(new URL("../../package.json", import.meta.url))
export const { chromium } = require("playwright")

// Legacy is reached on 127.0.0.1 so its session cookie stays apart from Current's on localhost.
export const BASE_URLS = {
  legacy: process.env.LEGACY_URL || "http://127.0.0.1:3001",
  current: process.env.CURRENT_URL || "http://localhost:3000"
}

// The sample-data user (`thor sample_data:sample_data`), present on both instances.
const EMAIL = process.env.QUEPID_EMAIL || "quepid+realisticactivity@o19s.com"
const PASSWORD = process.env.QUEPID_PASSWORD || "password"

export const isLegacy = (side) => side === "legacy"

/** Reads `--out <dir>` and `--sides legacy,current`, creating the output directory. */
export function parseCaptureArgs(usage) {
  const { values } = parseArgs({
    options: {
      out: { type: "string", default: "tmp/legacy_comparison" },
      sides: { type: "string", default: "legacy,current" },
      help: { type: "boolean", default: false }
    }
  })
  if (values.help) {
    console.log(usage)
    process.exit(0)
  }
  const sides = values.sides.split(",")
  const unknown = sides.filter((side) => !BASE_URLS[side])
  if (unknown.length) {
    console.error(`Unknown side: ${unknown.join(", ")}\n\n${usage}`)
    process.exit(1)
  }
  mkdirSync(values.out, { recursive: true })
  return { out: values.out, sides }
}

/**
 * Logs in on one side in a fresh 1400px-wide context. Native dialogs are accepted, and their
 * messages collected in `page.dialogs`.
 */
export async function openSide(browser, side) {
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    baseURL: BASE_URLS[side]
  })
  const page = await context.newPage()
  page.dialogs = []
  page.on("dialog", async (dialog) => {
    page.dialogs.push(dialog.message())
    await dialog.accept()
  })
  await page.goto("/sessions/new")
  const form = page.locator("form#login")
  await form.locator("#user_email").fill(EMAIL)
  await form.locator("#user_password").fill(PASSWORD)
  await form.locator('input[type="submit"]').first().click()
  await page.waitForURL((url) => !/sessions\/new/.test(String(url)))
  return page
}

export async function apiHeaders(page) {
  const csrf = await page.evaluate(
    () => document.querySelector('meta[name="csrf-token"]')?.content ?? ""
  )
  return { Accept: "application/json", "Content-Type": "application/json", "X-CSRF-Token": csrf }
}

/** Outlines every element each locator matches, in the comparison page's pink. */
export async function outline(...locators) {
  for (const locator of locators) {
    const count = await locator.count().catch(() => 0)
    for (let i = 0; i < count; i++) {
      await locator
        .nth(i)
        .evaluate((element) => {
          element.dataset.parityOutline = "1"
          element.style.outline = "3px solid #ff2d95"
          element.style.outlineOffset = "-3px"
          element.style.boxShadow = "inset 0 0 0 6px rgba(255,45,149,.18)"
        })
        .catch(() => {})
    }
  }
}

export async function clearOutlines(page) {
  await page.evaluate(() =>
    document.querySelectorAll("[data-parity-outline]").forEach((element) => {
      element.style.outline = ""
      element.style.boxShadow = ""
      delete element.dataset.parityOutline
    })
  )
}

/** Screenshot helpers that write `<name>-<side>.png` into `out`. */
export function shots(page, out, side) {
  const path = (name) => join(out, `${name}-${side}.png`)
  return {
    full: (name) => page.screenshot({ path: path(name) }),
    // The Tune Relevance drawer.
    pane: (name) =>
      page
        .locator(".pane_east")
        .first()
        .screenshot({ path: path(name) }),
    // The case wizard; Legacy's is a Bootstrap 3 modal.
    wizard: (name) =>
      page
        .locator(isLegacy(side) ? ".modal-dialog:visible" : "#wizardModal .modal-content")
        .first()
        .screenshot({ path: path(name) })
  }
}

/** Finds one of the user's cases by name and returns `{ id, lastTryNumber }`. */
export async function findCase(page, name) {
  const response = await page.request.get("/api/cases", { headers: await apiHeaders(page) })
  if (!response.ok()) throw new Error(`GET /api/cases: ${response.status()}`)
  const found = ((await response.json()).all_cases || []).find((item) => item.case_name === name)
  if (!found) throw new Error(`No case named "${name}"; load the sample data on this instance.`)
  return { id: found.case_id, lastTryNumber: found.last_try_number }
}

export async function deleteCase(page, id) {
  const response = await page.request.delete(`/api/cases/${id}`, {
    headers: await apiHeaders(page)
  })
  console.log(`deleted case ${id}: ${response.status()}`)
}

/**
 * Ids of every search endpoint the user can see, archived or not. A new try reuses an existing
 * endpoint with the same URL, so take this before creating tries and delete only the ids not in it.
 */
export async function existingSearchEndpointIds(page) {
  const ids = new Set()
  for (const archived of ["false", "true"]) {
    const response = await page.request.get(`/api/search_endpoints?archived=${archived}`, {
      headers: await apiHeaders(page)
    })
    if (!response.ok()) throw new Error(`GET /api/search_endpoints: ${response.status()}`)
    for (const endpoint of (await response.json()).search_endpoints || [])
      ids.add(endpoint.search_endpoint_id ?? endpoint.id)
  }
  return ids
}

/** Deletes a search endpoint unless it is in `existing` (from existingSearchEndpointIds). */
export async function deleteSearchEndpoint(page, id, existing) {
  if (!existing || existing.has(id)) {
    console.log(`kept search endpoint ${id}: it existed before this run`)
    return
  }
  const response = await page.request.delete(`/api/search_endpoints/${id}`, {
    headers: await apiHeaders(page)
  })
  console.log(`deleted search endpoint ${id}: ${response.status()}`)
}
