import { test, expect } from "@playwright/test"
import { gotoCase } from "./case_helpers"

test("re-vectorization shows activity on its button until polling finds completion", async ({
  page
}, testInfo) => {
  let polls = 0
  const runningState = {
    embedder_id: 7,
    embedder: {
      embedder_id: 7,
      name: "E2E embedder",
      provider: "Ollama",
      model: "all-minilm",
      dimensions: 128,
      accessible: true
    },
    embedders: [],
    vectors: {
      running: true,
      counts: { current: 18, pending: 2 },
      queries: {}
    }
  }
  const completedState = {
    ...runningState,
    vectors: { ...runningState.vectors, running: false, counts: { current: 20 } }
  }

  await page.route("**/api/cases/6/embedders**", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ json: runningState })
      return
    }

    polls += 1
    await route.fulfill({
      json:
        polls > 1
          ? completedState
          : { ...completedState, vectors: { ...completedState.vectors, counts: { pending: 20 } } }
    })
  })

  await gotoCase(page, "", 6)
  await page.getByRole("button", { name: "Select embedder" }).click()

  const modal = page.locator("#caseEmbedderModal")
  const button = modal.getByRole("button", { name: "Re-vectorize all queries" })
  await expect(button).toBeEnabled()
  await button.click()

  const spinner = modal.locator('[data-case-embedder-core-target="revectorizeSpinner"]')
  await expect(spinner).toBeVisible()
  await expect(modal.getByText("Vectorising…", { exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath("revectorizing-spinner.png") })

  await expect(modal.getByRole("button", { name: "Re-vectorize all queries" })).toBeEnabled({
    timeout: 10_000
  })
  await expect(spinner).toBeHidden()
})
