import { test, expect } from "@playwright/test"
import { apiHeaders } from "./case_helpers"

const name = `Usage popover ${Date.now()}`
let connectionId: string
let embedderId: string
let judgeId: string

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage()
  try {
    await page.goto("teams")
    const headers = await apiHeaders(page)
    const connection = await page.request.post("connections", {
      headers,
      data: {
        connection: {
          name,
          provider: "ollama",
          base_url: "http://ollama:11434",
          auth_scheme: "none"
        }
      },
      maxRedirects: 0
    })
    expect(connection.status()).toBe(302)
    connectionId = connection.headers().location.match(/connections\/(\d+)\/edit/)![1]
    const embedder = await page.request.post("embedders", {
      headers,
      data: {
        embedder: { name: `${name} embedder`, connection_id: connectionId, model: "all-minilm" }
      },
      maxRedirects: 0
    })
    expect(embedder.status()).toBe(302)
    embedderId = embedder.headers().location.match(/embedders\/(\d+)\/edit/)![1]
    const judge = await page.request.post("ai_judges", {
      headers,
      data: {
        user: {
          name: `${name} judge`,
          connection_id: connectionId,
          system_prompt: "Return a rating."
        }
      },
      maxRedirects: 0
    })
    expect(judge.status()).toBe(303)
    judgeId = judge.headers().location.match(/ai_judges\/(\d+)/)![1]
  } finally {
    await page.close()
  }
})

test.beforeEach(async ({ page }) => {
  // Provider health checks are independent of the usage-list interaction.
  await page.route("**/connections/*/status", (route) =>
    route.fulfill({ json: { status: "ok", message: "Connected", elapsed_ms: 1 } })
  )
})

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage()
  try {
    await page.goto("teams")
    const headers = await apiHeaders(page)
    for (const path of [
      judgeId && `ai_judges/${judgeId}`,
      embedderId && `embedders/${embedderId}`,
      connectionId && `connections/${connectionId}`
    ]) {
      if (!path) continue
      const response = await page.request.delete(path, { headers, maxRedirects: 0 })
      expect([302, 303]).toContain(response.status())
    }
  } finally {
    await page.close()
  }
})

test("usage loads only on click, is reused, dismisses and links to each record", async ({
  page
}) => {
  test.setTimeout(60_000)
  const requests: string[] = []
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.includes("/relationship_items/connection/"))
      requests.push(request.url())
  })
  await page.goto("connections")
  const row = page.getByRole("row").filter({ hasText: name })
  const embedderPill = row.getByRole("button", { name: "1 embedder", exact: true })
  await expect(embedderPill).toBeVisible()
  expect(requests).toHaveLength(0)
  await expect(row.getByRole("link", { name: `${name} embedder` })).toHaveCount(0)

  await embedderPill.click()
  const popover = page.getByRole("dialog", { name: `Embedders for ${name}`, exact: true })
  const embedderLink = popover.getByRole("link", { name: `${name} embedder`, exact: true })
  await expect(embedderLink).toHaveAttribute("href", new RegExp(`/embedders/${embedderId}/edit$`))
  await expect(embedderLink).toBeFocused()
  await expect(popover.locator(".popover-header")).toHaveCount(0)
  await expect(popover.locator(".popover-body")).toHaveText(`${name} embedder`)
  await expect(popover).toHaveAttribute("data-popper-placement", /^(top|bottom)/)
  expect(requests).toHaveLength(1)
  await page.keyboard.press("Escape")
  await expect(popover).toBeHidden()
  await expect(embedderPill).toBeFocused()

  await embedderPill.click()
  await expect(embedderLink).toBeVisible()
  expect(requests).toHaveLength(1)
  await embedderLink.click()
  await expect(page).toHaveURL(new RegExp(`/embedders/${embedderId}/edit$`))
  await page.goBack()
  await expect(page).toHaveURL(/\/connections$/)
  await expect(page.locator(".popover")).toHaveCount(0)

  await row.getByRole("button", { name: "1 AI judge", exact: true }).click()
  const judgePopover = page.getByRole("dialog", { name: `AI judges for ${name}`, exact: true })
  await judgePopover.getByRole("link", { name: `${name} judge`, exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/ai_judges/${judgeId}/edit$`))
})

test("failed loads can be retried and outside clicks dismiss the popover", async ({ page }) => {
  await page.goto("connections")
  const route = `**/relationship_items/connection/${connectionId}/embedders`
  await page.route(route, (request) => request.fulfill({ status: 503, body: "Unavailable" }))
  const pill = page
    .getByRole("row")
    .filter({ hasText: name })
    .getByRole("button", { name: "1 embedder", exact: true })
  await pill.click()
  const popover = page.getByRole("dialog", { name: `Embedders for ${name}`, exact: true })
  await expect(popover).toContainText("Unable to load this list")
  await page.keyboard.press("Escape")
  await page.unroute(route)
  await pill.click()
  await expect(popover.getByRole("link", { name: `${name} embedder`, exact: true })).toBeVisible()
  await page.getByRole("heading", { name: "Connections", exact: true }).click()
  await expect(popover).toBeHidden()
})
