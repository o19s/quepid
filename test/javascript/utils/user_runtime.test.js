import { afterEach, describe, expect, it, vi } from "vitest"
import { createUserRuntime } from "utils/user_runtime"

const response = data => ({ text: async function () { return JSON.stringify(await this.json()) || "" },  ok: true, status: 200, json: vi.fn(async () => data) })

describe("user runtime", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("initializes page data without a request and retains fresh API reads", async () => {
    const request = vi.fn().mockResolvedValue(response({ id: 7, default_scorer_id: 4 }))
    vi.stubGlobal("fetch", request)
    const runtime = createUserRuntime()

    const initial = runtime.initialize({ id: 7, default_scorer_id: 3, completed_case_wizard: false })

    expect(initial.defaultScorerId).toBe(3)
    expect(initial.completedCaseWizard).toBe(false)
    expect(runtime.current()).toBe(initial)
    expect(request).not.toHaveBeenCalled()
    expect((await runtime.loadCurrent()).defaultScorerId).toBe(4)
  })

  it("loads and normalizes the current user", async () => {
    const request = vi.fn().mockResolvedValue(response({
      id: 7,
      email: "user@example.com",
      default_scorer_id: 3,
      completed_case_wizard: false,
      cases_involved_with_count: 2,
      teams_involved_with_count: 1
    }))
    vi.stubGlobal("fetch", request)
    const runtime = createUserRuntime()

    const user = await runtime.loadCurrent()

    expect(request).toHaveBeenCalledWith("api/users/current", { method: "GET", headers: { Accept: "application/json", "X-CSRF-Token": "" } })
    expect(user).toMatchObject({
      id: 7,
      defaultScorerId: 3,
      completedCaseWizard: false,
      casesInvolvedWithCount: 2,
      teamsInvolvedWithCount: 1
    })
    expect(runtime.current()).toBe(user)
  })

  it("preserves the wizard completion PUT contract", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(response({ id: 9, completed_case_wizard: false }))
      .mockResolvedValueOnce(response({ id: 9, completed_case_wizard: true }))
    vi.stubGlobal("fetch", request)
    const runtime = createUserRuntime()

    await runtime.loadCurrent()
    const user = await runtime.shownIntroWizard()

    expect(request).toHaveBeenNthCalledWith(2, "api/users/9", {
      method: "PUT",
      headers: { Accept: "application/json", "Content-Type": "application/json", "X-CSRF-Token": "" },
      body: JSON.stringify({ user: { completed_case_wizard: true } })
    })
    expect(user.completedCaseWizard).toBe(true)
  })

  it("surfaces failed API responses", async () => {
    const request = vi.fn().mockResolvedValue({ text: async function () { return JSON.stringify(await this.json()) || "" },  ok: false, status: 503, json: vi.fn(async () => null) })
    vi.stubGlobal("fetch", request)
    const runtime = createUserRuntime()

    await expect(runtime.loadCurrent()).rejects.toThrow("Request failed (503)")
  })
})
