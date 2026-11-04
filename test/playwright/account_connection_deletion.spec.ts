import { test, expect } from "@playwright/test"
import { playwrightBaseURL } from "./env"

const email = `playwright-account-connection-${Date.now()}@example.com`
const password = "Playwright-Test-Password-1"
let accountCreated = false
let connectionId: string | undefined

test.use({ storageState: { cookies: [], origins: [] } })

test.afterAll(async ({ browser }) => {
  if (!accountCreated) return

  const page = await browser.newPage({ baseURL: playwrightBaseURL() })
  try {
    await page.goto("sessions/new")
    const login = page.locator("form#login")
    await login.locator("#user_email").fill(email)
    await login.locator("#user_password").fill(password)
    await login.locator('input[type="submit"]').click()
    await expect(page).not.toHaveURL(/\/sessions\/new/)

    const csrf = await page.locator('meta[name="csrf-token"]').getAttribute("content")
    const headers = { Accept: "application/json", "X-CSRF-Token": csrf ?? "" }
    const response = await page.request.get("api/embedders", { headers })
    expect(response.ok()).toBeTruthy()
    const { embedders } = await response.json()
    for (const embedder of embedders) {
      const deleted = await page.request.delete(`api/embedders/${embedder.embedder_id}`, {
        headers
      })
      expect(deleted.ok()).toBeTruthy()
    }
    const deleted = await page.request.delete("account", { headers })
    expect(deleted.status()).toBe(204)
  } finally {
    await page.close()
  }
})

test("account deletion preserves an owner whose connection is used by an embedder", async ({
  page
}, testInfo) => {
  await page.goto("sessions/new")
  const signup = page.locator("form#new_user")
  await signup.locator("#user_name").fill("Connection deletion test")
  await signup.locator("#user_email").fill(email)
  await signup.locator("#user_password").fill(password)
  await signup.locator("#user_password_confirmation").fill(password)
  await signup.locator('input[type="submit"]').click()
  await expect(page).not.toHaveURL(/\/sessions\/new/)
  accountCreated = true

  await page.goto("connections/new?service=ollama")
  await page.locator("#connection_name").fill("Deletion guard connection")
  await page.locator("#connection_base_url").fill("http://ollama:11434")
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await expect(page).toHaveURL(/\/connections\/\d+\/edit$/)
  connectionId = page.url().match(/\/connections\/(\d+)\/edit$/)?.[1]
  expect(connectionId).toBeDefined()

  await page.goto("embedders/new")
  await page.locator("#embedder_name").fill("Deletion guard embedder")
  await page.locator("#embedder_provider").selectOption("ollama")
  await page.locator("#embedder_connection_id").selectOption(connectionId!)
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await expect(page).toHaveURL(/\/embedders\/\d+\/edit$/)

  await page.goto("profile")
  await page.getByRole("button", { name: "Delete your account", exact: true }).click()
  const confirmation = page.locator("#confirmModal")
  await expect(confirmation).toBeVisible()
  const deletion = page.waitForResponse(
    (response) => response.request().method() !== "GET" && /\/account$/.test(response.url())
  )
  await confirmation.getByRole("button", { name: "Confirm", exact: true }).click()
  expect((await deletion).status()).toBe(422)
  await expect(page.locator("#error_explanation_danger_zone")).toContainText(
    "Please point embedders using this user's connections at another connection"
  )
  await page.screenshot({ path: testInfo.outputPath("connection-restricted.png"), fullPage: true })
  const current = await page.request.get("api/users/current")
  expect(current.ok()).toBeTruthy()
  await page.goto("embedders")
  await expect(
    page.getByRole("cell", { name: "Deletion guard embedder", exact: true })
  ).toBeVisible()
})
