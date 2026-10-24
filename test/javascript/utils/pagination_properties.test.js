import fc from "fast-check"
import { expect, it } from "vitest"
import { paginationRange } from "utils/pagination"

const pageState = fc.integer({ min: 1, max: 500 }).chain((pageCount) =>
  fc.record({
    pageCount: fc.constant(pageCount),
    currentPage: fc.integer({ min: 1, max: pageCount }),
    maxSize: fc.integer({ min: 1, max: 15 })
  })
)

it("stays bounded, keeps the first, last and current page, and marks every skipped run", () => {
  fc.assert(fc.property(pageState, ({ pageCount, currentPage, maxSize }) => {
    const pages = paginationRange(currentPage, pageCount, maxSize)
    const numbers = pages.filter((page) => page !== null)

    expect(pages).toHaveLength(Math.min(pageCount, Math.max(maxSize, 5)))
    expect(pages[0]).toBe(1)
    expect(pages.at(-1)).toBe(pageCount)
    expect(numbers).toContain(currentPage)
    pages.forEach((page, index) => {
      if (page === null) {
        expect(pages[index - 1] !== null && pages[index + 1] !== null).toBe(true)
        expect(pages[index + 1] - pages[index - 1]).toBeGreaterThan(1)
      } else if (index > 0 && pages[index - 1] !== null) {
        expect(page - pages[index - 1]).toBe(1)
      }
    })
  }))
})
