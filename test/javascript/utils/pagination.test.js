import { describe, expect, it } from "vitest"
import { paginationRange } from "utils/pagination"

describe("paginationRange", () => {
  it("lists every page when they fit", () => {
    expect(paginationRange(1, 1)).toEqual([1])
    expect(paginationRange(2, 3)).toEqual([1, 2, 3])
    expect(paginationRange(5, 9)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  // Expected values are Legacy's dir-pagination-controls output for the same inputs.
  it("truncates near the start, middle and end as Legacy did", () => {
    expect(paginationRange(1, 47)).toEqual([1, 2, 3, 4, 5, 6, 7, null, 47])
    expect(paginationRange(5, 47)).toEqual([1, 2, 3, 4, 5, 6, 7, null, 47])
    expect(paginationRange(6, 47)).toEqual([1, null, 4, 5, 6, 7, 8, null, 47])
    expect(paginationRange(24, 47)).toEqual([1, null, 22, 23, 24, 25, 26, null, 47])
    expect(paginationRange(42, 47)).toEqual([1, null, 40, 41, 42, 43, 44, null, 47])
    expect(paginationRange(43, 47)).toEqual([1, null, 41, 42, 43, 44, 45, 46, 47])
    expect(paginationRange(47, 47)).toEqual([1, null, 41, 42, 43, 44, 45, 46, 47])
    expect(paginationRange(1, 10)).toEqual([1, 2, 3, 4, 5, 6, 7, null, 10])
  })

  it("never uses fewer than five entries", () => {
    expect(paginationRange(10, 20, 3)).toEqual([1, null, 10, null, 20])
  })
})
