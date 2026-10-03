import { afterEach, describe, expect, it } from "vitest"
import { quepidSearch } from "core_runtime"

describe("core runtime case state", () => {
  afterEach(() => {
    quepidSearch.caseState = {
      caseNo: null,
      caseName: "",
      bookId: null,
      bookName: null
    }
  })

  it("synchronizes case metadata from the selection event", () => {
    document.dispatchEvent(new CustomEvent("quepid:case-selected", {
      detail: { caseNo: 7, caseName: "Books", bookId: 12, bookName: "Catalog" }
    }))

    expect(quepidSearch.caseState).toMatchObject({
      caseNo: 7,
      caseName: "Books",
      bookId: 12,
      bookName: "Catalog"
    })
  })

  it("updates the book on the active case when its book settings are saved", () => {
    quepidSearch.caseState = { caseNo: 7, caseName: "Books", bookId: 12, bookName: "Catalog" }

    document.dispatchEvent(new CustomEvent("judgements:book-settings-saved", {
      detail: { caseId: 8, bookId: 99, bookName: "Other" }
    }))
    expect(quepidSearch.caseState).toMatchObject({ bookId: 12, bookName: "Catalog" })

    document.dispatchEvent(new CustomEvent("judgements:book-settings-saved", {
      detail: { caseId: 7, bookId: null, bookName: null }
    }))
    expect(quepidSearch.caseState).toMatchObject({ caseNo: 7, bookId: null, bookName: null })
  })
})
