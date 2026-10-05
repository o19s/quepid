import { describe, expect, it, vi } from "vitest"
import { subscribeToStore } from "utils/store_subscription"

describe("subscribeToStore", () => {
  it("delivers the original event synchronously with native listener context", () => {
    const store = new EventTarget()
    const calls = []
    const handler = function (event) { calls.push({ event, context: this }) }
    const unsubscribe = subscribeToStore(store, { change: handler, reset: handler })
    const event = new CustomEvent("change", { detail: { queryId: 7 } })
    store.dispatchEvent(event)
    expect(calls).toEqual([{ event, context: store }])
    unsubscribe()
    unsubscribe()
    store.dispatchEvent(new Event("reset"))
    expect(calls).toHaveLength(1)
  })

  it("removes only its listeners and allows a fresh subscription after cleanup", () => {
    const store = new EventTarget()
    const external = vi.fn()
    const handler = vi.fn()
    store.addEventListener("change", external)
    const unsubscribe = subscribeToStore(store, { change: handler })
    unsubscribe()
    const reconnected = subscribeToStore(store, { change: handler })
    store.dispatchEvent(new Event("change"))
    expect(handler).toHaveBeenCalledTimes(1)
    expect(external).toHaveBeenCalledTimes(1)
    reconnected()
    store.dispatchEvent(new Event("change"))
    expect(handler).toHaveBeenCalledTimes(1)
    expect(external).toHaveBeenCalledTimes(2)
  })
})
