import { test, expect } from "@playwright/test"
import { apiHeaders } from "./case_helpers"

test.describe("embedder edit navigation", () => {
  let embedderId: string | undefined
  let connectionId: string | undefined

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage()
    try {
      await page.goto("embedders")
      const headers = await apiHeaders(page)
      for (const path of [
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

  test("invalid edits keep the form and successful saves return to Embedders", async ({ page }) => {
    const name = `Embedder navigation ${Date.now()}`
    await page.goto("connections")
    const connection = await page.request.post("connections", {
      headers: await apiHeaders(page),
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
    connectionId = connection.headers().location.match(/connections\/(\d+)\/edit/)?.[1]
    expect(connectionId).toBeTruthy()
    await page.goto("embedders/new")
    await page.locator("#embedder_name").fill(name)
    await page.locator("#embedder_connection_id").selectOption(connectionId!)
    await page.locator("#embedder_model").fill("all-minilm:22m")
    await page.getByRole("button", { name: "Save", exact: true }).click()
    await expect(page).toHaveURL(/\/embedders\/\d+\/edit$/)
    embedderId = new URL(page.url()).pathname.split("/").at(-2)
    await page.locator("#embedder_name").fill("")
    await page.getByRole("button", { name: "Save", exact: true }).click()
    await expect(page.locator(".alert-danger")).toBeVisible()
    await expect(page.locator("#embedder_name")).toHaveValue("")
    await page.locator("#embedder_name").fill(`${name} updated`)
    await page.getByRole("button", { name: "Save", exact: true }).click()
    await expect(page).toHaveURL(/\/embedders$/)
    await expect(
      page.getByText("Embedder was successfully updated.", { exact: true })
    ).toBeVisible()
    await expect(page.getByRole("row").filter({ hasText: `${name} updated` })).toBeVisible()
    await page.reload()
    await expect(page.getByRole("row").filter({ hasText: `${name} updated` })).toBeVisible()
  })
})
