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

  it("loads and selects a case without framework objects", async () => {
    const request = vi.fn().mockResolvedValue(response({
      case_id: 7,
      case_name: "Books",
      last_try_number: 2,
      tries: [{ try_number: 2 }]
    }))
    const runtime = createCaseRuntime({ request })
    const selected = vi.fn()
    document.addEventListener("quepid:case-selected", selected)

    const value = await runtime.load(7)
    runtime.select(value)

    expect(value).toMatchObject({ caseNo: 7, caseName: "Books", lastTry: 2 })
    expect(runtime.selected()).toBe(value)
    expect(selected).toHaveBeenCalledWith(expect.objectContaining({
      type: "quepid:case-selected",
      detail: expect.objectContaining({ caseNo: 7, caseName: "Books" })
    }))
    document.removeEventListener("quepid:case-selected", selected)
  })

  it("publishes the selected case details for shared runtime state", () => {
    const runtime = createCaseRuntime()
    const selected = vi.fn()
    document.addEventListener("quepid:case-selected", selected)

    runtime.select({ caseNo: 7, caseName: "Books", bookId: 12, bookName: "Catalog" })

    expect(selected).toHaveBeenCalledWith(expect.objectContaining({
      detail: {
        caseNo: 7,
        caseName: "Books",
        bookId: 12,
        bookName: "Catalog"
      }
    }))
    document.removeEventListener("quepid:case-selected", selected)
  })

  it("deletes a case, clearing the selection only when it was the deleted case", async () => {
    const request = vi.fn().mockResolvedValue(response({}, 204))
    const runtime = createCaseRuntime({ request })
    runtime.select({ caseNo: 7 })

    await runtime.delete({ caseNo: 8 })
    expect(runtime.selected()).toEqual({ caseNo: 7 })

    await runtime.delete({ caseNo: 7 })
    expect(runtime.selected()).toBeNull()
    expect(request).toHaveBeenCalledWith("api/cases/7", expect.objectContaining({ method: "DELETE" }))
  })

  it("rejects failed mutations with the action and status, and ignores a blank rename", async () => {
    const request = vi.fn().mockResolvedValue({ ok: false, status: 403, json: vi.fn() })
    const runtime = createCaseRuntime({ request })

    await expect(runtime.delete({ caseNo: 7 })).rejects.toThrow("Unable to delete case (403)")
    await runtime.rename({ caseNo: 7 }, "")
    expect(request).toHaveBeenCalledOnce()
  })

  it("queues an evaluation, scoped to a try when one is given", async () => {
    const request = vi.fn().mockResolvedValue(response())
    const runtime = createCaseRuntime({ request })

    await runtime.runEvaluation(7, 3)
    await runtime.runEvaluation(7)

    expect(request.mock.calls[0][0]).toBe("api/cases/7/run_evaluation?try_number=3")
    expect(request.mock.calls[0][1].method).toBe("POST")
    expect(request.mock.calls[1][0]).toBe("api/cases/7/run_evaluation")
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
