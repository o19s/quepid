import { test, expect } from "@playwright/test"

test("choosing a connection determines the new embedder provider", async ({ page }, testInfo) => {
  await page.goto("embedders/new")

  const connection = page.locator("#embedder_connection_id")
  await expect(page.locator("select#embedder_provider")).toHaveCount(0)
  await expect(page.locator("#embedder_provider")).toHaveValue("")
  await expect(connection.locator('option[data-provider="ollama"]')).toHaveCount(1)

  await connection.selectOption({ label: "Ollama (Ollama)" })

  await expect(page.locator("#embedder_provider")).toHaveValue("ollama")
  await expect(page.locator("#embedder_model")).toHaveValue("all-minilm:22m")
  await expect(page.locator('[data-embedder-form-target="checkButton"]')).toBeEnabled()
  await expect(
    page.locator('[data-embedder-form-target="help"][data-provider="ollama"]')
  ).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath("ollama-provider-from-connection.png"),
    fullPage: true
  })
})
