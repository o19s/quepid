import { test, expect } from "@playwright/test"
import { apiHeaders } from "./case_helpers"

test.describe("AI judge edit navigation", () => {
  let judgeId: string | undefined
  let connectionId: string | undefined

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage()
    try {
      await page.goto("ai_judges")
      const headers = await apiHeaders(page)
      for (const path of [
        judgeId && `ai_judges/${judgeId}`,
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

  test("invalid edits keep the form and successful saves return to AI Judges", async ({ page }) => {
    const name = `Judge navigation ${Date.now()}`
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
    await page.goto("ai_judges/new")
    await page.locator("#user_name").fill(name)
    await page.locator("#user_connection_id").selectOption(connectionId!)
    await page.locator("#user_system_prompt").fill("Return a relevance rating.")
    await page.getByRole("button", { name: "Save", exact: true }).click()
    await expect(page).toHaveURL(/\/ai_judges\/\d+$/)
    judgeId = new URL(page.url()).pathname.split("/").at(-1)
    await page.locator("#user_name").fill("")
    await page.getByRole("button", { name: "Save", exact: true }).click()
    await expect(
      page.getByRole("heading", { name: /prohibited this ai_judge from being saved/ })
    ).toBeVisible()
    await expect(page.locator("#user_name")).toHaveValue("")
    await page.locator("#user_name").fill(`${name} updated`)
    await page.getByRole("button", { name: "Save", exact: true }).click()
    await expect(page).toHaveURL(/\/ai_judges$/)
    await expect(
      page.getByText("AI Judge was successfully updated.", { exact: true })
    ).toBeVisible()
    await expect(page.getByRole("row").filter({ hasText: `${name} updated` })).toBeVisible()
    await page.reload()
    await expect(page.getByRole("row").filter({ hasText: `${name} updated` })).toBeVisible()
  })
})
