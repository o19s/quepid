import { afterEach, describe, expect, it, vi } from "vitest"
import { createUserRuntime } from "utils/user_runtime"

const response = data => ({ text: async function () { return JSON.stringify(await this.json()) || "" },  ok: true, status: 200, json: vi.fn(async () => data) })

describe("user runtime", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("initializes and normalizes page data without a request", () => {
    const request = vi.fn()
    vi.stubGlobal("fetch", request)
    const runtime = createUserRuntime()

    const user = runtime.initialize({
      id: 7,
      email: "user@example.com",
      default_scorer_id: 3,
      completed_case_wizard: false,
      cases_involved_with_count: 2,
      teams_involved_with_count: 1
    })
    expect(user).toMatchObject({
      id: 7,
      defaultScorerId: 3,
      completedCaseWizard: false,
      casesInvolvedWithCount: 2,
      teamsInvolvedWithCount: 1
    })
    expect(runtime.current()).toBe(user)
    expect(request).not.toHaveBeenCalled()
  })

  it("preserves the wizard completion PUT contract", async () => {
    const request = vi.fn().mockResolvedValue(response({ id: 9, completed_case_wizard: true }))
    vi.stubGlobal("fetch", request)
    const runtime = createUserRuntime()

    runtime.initialize({ id: 9, completed_case_wizard: false })
    const user = await runtime.shownIntroWizard()

    expect(request).toHaveBeenCalledWith("api/users/9", {
      method: "PUT",
      headers: { Accept: "application/json", "Content-Type": "application/json", "X-CSRF-Token": "" },
      body: JSON.stringify({ user: { completed_case_wizard: true } })
    })
    expect(user.completedCaseWizard).toBe(true)
  })

  it("surfaces failed wizard completion without marking the user complete", async () => {
    const request = vi.fn().mockResolvedValue({ text: async function () { return JSON.stringify(await this.json()) || "" },  ok: false, status: 503, json: vi.fn(async () => null) })
    vi.stubGlobal("fetch", request)
    const runtime = createUserRuntime()
    runtime.initialize({ id: 9, completed_case_wizard: false })

    await expect(runtime.shownIntroWizard()).rejects.toThrow("Request failed (503)")
    expect(runtime.current().completedCaseWizard).toBe(false)
  })
})
