import { beforeEach, describe, expect, it } from "vitest"
import { DiffStateStore } from "stores/diff_state_store"

describe("DiffStateStore", () => {
  let store

  beforeEach(() => {
    store = new DiffStateStore()
  })

  it("normalizes and returns selected snapshot ids", () => {
    store.enable([7, "8"])

    expect(store.selections()).toEqual(["7", "8"])
    expect(store.snapshot().disabled).toBe(false)
  })

  it("clears selections when comparisons are disabled", () => {
    store.enable([7])
    store.disable()

    expect(store.selections()).toEqual([])
    expect(store.snapshot().disabled).toBe(true)
  })

  it("resets selections and disabled state for a fresh case workspace", () => {
    store.enable([7, 8])
    store.disable()
    store.reset()

    expect(store.selections()).toEqual([])
    expect(store.snapshot().disabled).toBe(false)
  })
})
