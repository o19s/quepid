import { test, expect } from "@playwright/test"
import { apiHeaders } from "./case_helpers"

test.describe("connection edit navigation", () => {
  let connectionId: string | undefined

  test.afterAll(async ({ browser }) => {
    if (!connectionId) return
    const page = await browser.newPage()
    try {
      await page.goto("connections")
      const response = await page.request.delete(`connections/${connectionId}`, {
        headers: await apiHeaders(page),
        maxRedirects: 0
      })
      expect([302, 303]).toContain(response.status())
    } finally {
      await page.close()
    }
  })

  test("invalid edits stay on the form and a successful save returns to the index", async ({
    page
  }) => {
    const name = `Connection navigation ${Date.now()}`
    await page.goto("connections/new?provider=ollama")
    await page.locator("#connection_name").fill(name)
    await page.locator("#connection_base_url").fill("http://ollama:11434")
    await page.getByRole("button", { name: "Save", exact: true }).click()
    await expect(page).toHaveURL(/\/connections\/\d+\/edit$/)
    connectionId = new URL(page.url()).pathname.split("/").at(-2)
    await page.getByRole("tab", { name: "Advanced", exact: true }).click()
    await page.locator("#connection_timeout").fill("601")
    const form = page.locator("form").filter({ has: page.locator("#connection_name") })
    await form.evaluate((element) => element.setAttribute("novalidate", ""))
    await page.getByRole("button", { name: "Save", exact: true }).click()
    await expect(page.locator("#connection_timeout")).toHaveValue("601")
    await expect(page.locator(".alert-danger")).toContainText("less than or equal to 600")
    await page.locator("#connection_timeout").fill("30")
    await page.locator("#connection_name").fill(`${name} updated`)
    await page.getByRole("button", { name: "Save", exact: true }).click()
    await expect(page).toHaveURL(/\/connections$/)
    await expect(
      page.getByText("Connection was successfully updated.", { exact: true })
    ).toBeVisible()
    await expect(page.getByRole("row").filter({ hasText: `${name} updated` })).toBeVisible()
    await page.reload()
    await expect(page.getByRole("row").filter({ hasText: `${name} updated` })).toBeVisible()
  })
})
