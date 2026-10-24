import { describe, expect, it, vi } from "vitest"
import { lazyDetail } from "utils/lazy_detail"

describe("lazyDetail", () => {
  it("does not build the snapshot until a snapshot field is read", () => {
    const build = vi.fn(() => ({ a: 1, b: 2 }))
    const detail = lazyDetail(["a", "b"], build, { queryId: 5 })

    expect(detail.queryId).toBe(5)
    expect(build).not.toHaveBeenCalled()

    expect(detail.a).toBe(1)
    expect(detail.b).toBe(2)
    expect(build).toHaveBeenCalledTimes(1)
  })

  it("is enumerable so spreading and matching see every field", () => {
    const detail = lazyDetail(["a", "b"], () => ({ a: 1, b: 2 }), { queryId: 5 })

    expect(detail).toEqual({ a: 1, b: 2, queryId: 5 })
    expect({ ...detail }).toEqual({ a: 1, b: 2, queryId: 5 })
  })

  it("keeps extra fields over snapshot fields of the same name", () => {
    const detail = lazyDetail(["queryId", "a"], () => ({ queryId: null, a: 1 }), { queryId: 5 })

    expect(detail.queryId).toBe(5)
    expect(detail.a).toBe(1)
  })
})
