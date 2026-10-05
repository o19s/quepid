import { afterEach, describe, expect, it } from "vitest"
import { quepidSearch } from "core_runtime"
import { caseRuntime } from "utils/case_runtime"

describe("core runtime case state", () => {
  afterEach(() => caseRuntime.reset())

  it("reads the selected record rather than copying its event payload", () => {
    const value = { caseNo: 7, caseName: "Books", bookId: 12, bookName: "Catalog" }
    caseRuntime.select(value)
    expect(quepidSearch.caseState).toBe(value)
    value.bookId = null
    expect(quepidSearch.caseState.bookId).toBeNull()
    caseRuntime.reset()
    expect(quepidSearch.caseState.caseNo).toBeNull()
  })
})
