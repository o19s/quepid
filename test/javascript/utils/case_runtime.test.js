import { afterEach, describe, expect, it, vi } from "vitest"
import { createCaseRuntime } from "utils/case_runtime"

const response = (data = {}, status = 200) => ({
  async text() {
    return JSON.stringify(await this.json()) || ""
  },
  ok: true,
  status,
  json: vi.fn(async () => data)
})

describe("case runtime", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

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
    vi.stubGlobal("fetch", request)
    const runtime = createCaseRuntime()
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
    vi.stubGlobal("fetch", request)
    const runtime = createCaseRuntime()
    runtime.select({ caseNo: 7 })

    await runtime.delete({ caseNo: 8 })
    expect(runtime.selected()).toEqual({ caseNo: 7 })

    await runtime.delete({ caseNo: 7 })
    expect(runtime.selected()).toBeNull()
    expect(request).toHaveBeenCalledWith("api/cases/7", expect.objectContaining({ method: "DELETE" }))
  })

  it("rejects failed mutations with the action and status, and ignores a blank rename", async () => {
    const request = vi.fn().mockResolvedValue({ text: async function () { return JSON.stringify(await this.json()) || "" },  ok: false, status: 403, json: vi.fn(async () => null) })
    vi.stubGlobal("fetch", request)
    const runtime = createCaseRuntime()

    await expect(runtime.delete({ caseNo: 7 })).rejects.toThrow("Request failed (403)")
    await runtime.rename({ caseNo: 7 }, "")
    expect(request).toHaveBeenCalledOnce()
  })

  it("queues an evaluation, scoped to a try when one is given", async () => {
    const request = vi.fn().mockResolvedValue(response())
    vi.stubGlobal("fetch", request)
    const runtime = createCaseRuntime()

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
    vi.stubGlobal("fetch", request)
    const runtime = createCaseRuntime({ now: () => new Date(2026, 8, 28, 21, 40, 5) })
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
      Accept: "application/json",
      "X-CSRF-Token": ""
    })
    expect(request.mock.calls[2][1].body).toContain("2026-09-28 21:40:05")
    document.removeEventListener("quepid:case-renamed", renamed)
    document.removeEventListener("quepid:case-header-stale", stale)
  })
  it("coalesces concurrent reads but fetches fresh data on the next open", async () => {
    let finish
    const request = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
      .mockResolvedValueOnce(response({ case_id: 7, book_id: 9 }))
    vi.stubGlobal("fetch", request)
    const runtime = createCaseRuntime()
    runtime.select({ caseNo: 7, bookId: 1 })
    const first = runtime.read(7)
    const second = runtime.read(7)
    finish(response({ case_id: 7, book_id: 8 }))
    await Promise.all([first, second])
    expect(request).toHaveBeenCalledOnce()
    expect(runtime.selected().bookId).toBe(8)
    await runtime.read(7)
    expect(runtime.selected().bookId).toBe(9)
    expect(request).toHaveBeenCalledTimes(2)
  })

  it("does not let a response from a previous selection overwrite the current record", async () => {
    let finish
    vi.stubGlobal("fetch", vi.fn(() => new Promise(resolve => { finish = resolve })))
    const runtime = createCaseRuntime()
    runtime.select({ caseNo: 7 })
    const reading = runtime.read(7)
    runtime.select({ caseNo: 8, bookId: 12 })
    finish(response({ case_id: 7, book_id: 99 }))
    await reading
    expect(runtime.selected()).toEqual({ caseNo: 8, bookId: 12 })
  })

  it("allows retry after a failed refresh without losing selected settings", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(response({ case_id: 7, book_id: 9 })))
    const runtime = createCaseRuntime()
    runtime.select({ caseNo: 7, bookId: 12 })
    await expect(runtime.read(7)).rejects.toThrow("offline")
    expect(runtime.selected().bookId).toBe(12)
    await runtime.read(7)
    expect(runtime.selected().bookId).toBe(9)
  })

  it("saves book settings in the selected record and invalidates an older refresh", async () => {
    let finish
    vi.stubGlobal("fetch", vi.fn()
      .mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
      .mockResolvedValueOnce(response({ book_name: "New book" })))
    const runtime = createCaseRuntime()
    const selected = { caseNo: 7, bookId: 1 }
    runtime.select(selected)
    const reading = runtime.read(7)
    await runtime.saveBookSettings(7, {
      book_id: 9, auto_populate_book_pairs: true, auto_populate_case_judgements: false
    })
    finish(response({ case_id: 7, book_id: 1 }))
    await reading
    expect(runtime.selected()).toBe(selected)
    expect(selected).toMatchObject({
      bookId: 9, bookName: "New book", autoPopulateBookPairs: true,
      autoPopulateCaseJudgements: false
    })
  })

  it("keeps the newest overlapping refresh and publishes its book settings", async () => {
    const finish = []
    vi.stubGlobal("fetch", vi.fn(() => new Promise(resolve => finish.push(resolve))))
    const runtime = createCaseRuntime()
    runtime.select({ caseNo: 7, bookId: 1 })
    const updated = vi.fn()
    document.addEventListener("quepid:case-book-updated", updated)
    try {
      const first = runtime.read(7, { url: "api/cases/7?shallow=false" })
      const second = runtime.read(7)
      finish[1](response({ case_id: 7, book_id: 9, auto_populate_book_pairs: true }))
      await second
      finish[0](response({ case_id: 7, book_id: 1 }))
      await first
      expect(runtime.selected().bookId).toBe(9)
      expect(updated).toHaveBeenCalledOnce()
      expect(updated.mock.calls[0][0].detail).toMatchObject({ bookId: 9, autoPopulateBookPairs: true })
    } finally {
      document.removeEventListener("quepid:case-book-updated", updated)
    }
  })

  it("does not publish a save for a previous selection, and preserves settings on failure", async () => {
    let finish
    vi.stubGlobal("fetch", vi.fn()
      .mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
      .mockRejectedValueOnce(new Error("offline")))
    const runtime = createCaseRuntime()
    runtime.select({ caseNo: 7, bookId: 1 })
    const updated = vi.fn()
    document.addEventListener("quepid:case-book-updated", updated)
    try {
      const saving = runtime.saveBookSettings(7, { book_id: 9 })
      runtime.select({ caseNo: 8, bookId: 12 })
      finish(response({ book_name: "Old selection" }))
      await saving
      expect(updated).not.toHaveBeenCalled()
      await expect(runtime.saveBookSettings(8, { book_id: 99 })).rejects.toThrow("offline")
      expect(runtime.selected().bookId).toBe(12)
    } finally {
      document.removeEventListener("quepid:case-book-updated", updated)
    }
  })

  it.each(["before", "during"])("preserves a Nightly save against a refresh started %s the PUT", async (ordering) => {
    let finishRead
    let finishWrite
    vi.stubGlobal("fetch", vi.fn((_url, options) => new Promise(resolve => {
      if (options.method === "PUT") finishWrite = resolve
      else finishRead = resolve
    })))
    const runtime = createCaseRuntime()
    const selected = { caseNo: 7, nightly: false }
    runtime.select(selected)
    let reading
    if (ordering === "before") reading = runtime.read(7)
    selected.nightly = true
    const saving = runtime.updateNightly(selected)
    if (ordering === "during") reading = runtime.read(7)
    finishRead(response({ case_id: 7, nightly: false }))
    await reading
    finishWrite(response())
    await saving
    expect(runtime.selected().nightly).toBe(true)
  })

  it("invalidates a refresh still pending when the Nightly save completes", async () => {
    let finishRead
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(response())
      .mockImplementationOnce(() => new Promise(resolve => { finishRead = resolve })))
    const runtime = createCaseRuntime()
    runtime.select({ caseNo: 7, nightly: true })
    const saving = runtime.updateNightly(runtime.selected())
    const reading = runtime.read(7)
    await saving
    finishRead(response({ case_id: 7, nightly: false }))
    await reading
    expect(runtime.selected().nightly).toBe(true)
  })

})
