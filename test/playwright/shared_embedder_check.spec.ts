import { test, expect } from "@playwright/test"
import { createServer, type Server } from "node:http"
import { apiHeaders } from "./case_helpers"
import { playwrightBaseURL } from "./env"

const name = `Shared embedder check ${Date.now()}`
let server: Server
let providerUrl: string
let teamId: number | undefined
let connectionId: string | undefined
let embedderId: number | undefined
let checkedModel: string | undefined
let checkedInput: string[] | undefined
let authorization: string | undefined

test.beforeAll(async () => {
  server = createServer(async (request, response) => {
    let body = ""
    for await (const chunk of request) body += chunk
    const payload = JSON.parse(body || "{}")
    checkedModel = payload.model
    checkedInput = payload.input
    authorization = request.headers.authorization
    response.setHeader("Content-Type", "application/json")
    response.end(JSON.stringify({ data: [{ index: 0, embedding: [0.1, 0.2, 0.3] }] }))
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("No embedding fixture address")
  providerUrl = `http://127.0.0.1:${address.port}`
})

test.afterAll(async ({ browser }) => {
  const errors: unknown[] = []
  const context = await browser.newContext({
    baseURL: playwrightBaseURL(),
    storageState: "test/playwright/.auth/user.json"
  })
  try {
    const page = await context.newPage()
    await page.goto("embedders")
    const headers = await apiHeaders(page)
    for (const url of [
      embedderId && `api/embedders/${embedderId}`,
      connectionId && `connections/${connectionId}`,
      teamId && `api/teams/${teamId}`
    ].filter(Boolean)) {
      try {
        const response = await page.request.delete(url as string, {
          maxRedirects: 0,
          headers: {
            ...headers,
            Accept: String(url).startsWith("api/") ? "application/json" : "text/html"
          }
        })
        if (String(url).startsWith("api/")) {
          expect(response.ok()).toBeTruthy()
        } else {
          expect(response.status()).toBe(302)
        }
      } catch (error) {
        errors.push(error)
      }
    }
  } finally {
    await context.close()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
  if (errors.length) throw new AggregateError(errors, "Shared embedder fixture cleanup failed")
})

test("a teammate checks unsaved settings through the embedder's private saved connection", async ({
  page,
  browser
}, testInfo) => {
  const memberEmail = process.env.QUEPID_E2E_NON_ADMIN_EMAIL ?? "quepid+es@o19s.com"
  const memberPassword = process.env.QUEPID_E2E_NON_ADMIN_PASSWORD ?? "password"
  await page.goto("embedders")
  const headers = await apiHeaders(page)
  const team = await page.request.post("api/teams", { headers, data: { team: { name } } })
  expect(team.ok()).toBeTruthy()
  teamId = (await team.json()).id
  const member = await page.request.post(`api/teams/${teamId}/members`, {
    headers,
    data: { id: memberEmail }
  })
  expect(member.ok()).toBeTruthy()

  const connection = await page.request.post("connections", {
    headers: { ...headers, Accept: "text/html" },
    form: {
      "connection[name]": name,
      "connection[provider]": "openai_compatible",
      "connection[base_url]": providerUrl,
      "connection[auth_scheme]": "bearer",
      "connection[secret]": "fixture-private-key"
    }
  })
  connectionId = connection.url().match(/\/connections\/(\d+)\/edit$/)?.[1]
  expect(connectionId).toBeDefined()
  const embedder = await page.request.post("api/embedders", {
    headers,
    data: {
      embedder: { name, connection_id: connectionId, model: "saved-model", team_ids: [teamId] }
    }
  })
  expect(embedder.ok()).toBeTruthy()
  embedderId = (await embedder.json()).embedder_id

  const context = await browser.newContext({ baseURL: playwrightBaseURL() })
  try {
    const teammate = await context.newPage()
    await teammate.goto("sessions/new")
    const login = teammate.locator("form#login")
    await login.locator("#user_email").fill(memberEmail)
    await login.locator("#user_password").fill(memberPassword)
    await login.locator('input[type="submit"]').click()
    await expect(teammate).not.toHaveURL(/\/sessions\/new/)
    await teammate.goto(`connections/${connectionId}`)
    await expect(teammate).toHaveURL(/\/connections$/)
    await teammate.goto(`embedders/${embedderId}/edit`)
    await teammate.locator("#embedder_model").fill("unsaved-model")
    await teammate.locator('[data-embedder-form-target="checkText"]').fill("shared sample")
    await teammate.getByRole("button", { name: "Check connection", exact: true }).click()
    const result = teammate.locator('[data-embedder-form-target="checkResult"]')
    await expect(result).toContainText("3 dimensions")
    await expect(result).toContainText("shared sample")
    expect(checkedModel).toBe("unsaved-model")
    expect(checkedInput).toEqual(["shared sample"])
    expect(authorization).toBe("Bearer fixture-private-key")
    await teammate.screenshot({
      path: testInfo.outputPath("shared-check-success.png"),
      fullPage: true
    })
    await teammate.reload()
    await expect(teammate.locator("#embedder_model")).toHaveValue("saved-model")
  } finally {
    await context.close()
  }
})
