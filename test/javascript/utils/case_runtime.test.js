import { afterEach, describe, expect, it, vi } from "vitest"
import { createCaseRuntime } from "utils/case_runtime"

const response = (data = {}, status = 200) => ({
  ok: true,
  status,
  json: vi.fn(async () => data)
})

describe("case runtime", () => {
  afterEach(() => {
    delete window.quepidSearch
  })

  it("loads and selects a case without Angular objects", async () => {
    const request = vi.fn().mockResolvedValue(response({
      case_id: 7,
      case_name: "Books",
      last_try_number: 2,
      tries: [{ try_number: 2 }]
    }))
    const runtime = createCaseRuntime({ request })
    window.quepidSearch = {}

    const value = await runtime.load(7)
    runtime.select(value)

    expect(value).toMatchObject({ caseNo: 7, caseName: "Books", lastTry: 2 })
    expect(runtime.selected()).toBe(value)
    expect(window.quepidSearch.caseState).toMatchObject({ caseNo: 7, caseName: "Books" })
  })

  it("preserves case mutations and server-rendered header events", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce(response())
    const runtime = createCaseRuntime({ request, now: () => new Date(2026, 8, 28, 21, 40, 5) })
    const value = { caseNo: 7, caseName: "Old", nightly: false }
    const renamed = vi.fn()
    const stale = vi.fn()
    document.addEventListener("quepid:case-renamed", renamed)
    document.addEventListener("quepid:case-header-stale", stale)

    await runtime.rename(value, "New")
    value.nightly = true
    await runtime.updateNightly(value)
    await runtime.trackLastViewedAt(7)

    expect(value.caseName).toBe("New")
    expect(renamed).toHaveBeenCalledOnce()
    expect(stale).toHaveBeenCalledOnce()
    expect(request.mock.calls[0][1].headers).toEqual({
      "Content-Type": "application/json",
      Accept: "application/json"
    })
    expect(request.mock.calls[2][1].body).toContain("2026-09-28 21:40:05")
    document.removeEventListener("quepid:case-renamed", renamed)
    document.removeEventListener("quepid:case-header-stale", stale)
  })
})
