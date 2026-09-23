import { describe, expect, it, vi } from "vitest"
import QueryLifecycleController from "controllers/query_lifecycle_controller"

function controllerFor(addQueries) {
  const element = document.createElement("div")
  element.innerHTML = '<form data-controller="add-query"></form>'
  const controller = new QueryLifecycleController(element)
  controller.element = element
  window.quepidSearch = { queryLifecycle: { addQueries } }
  window.quepidDom = { flash: { show: vi.fn() } }
  return { controller, element }
}

describe("query_lifecycle_controller", () => {
  it("runs the add-query workflow and completes the form", async () => {
    const addQueries = vi.fn().mockResolvedValue({})
    const { controller, element } = controllerFor(addQueries)
    const complete = vi.fn()
    element.querySelector("form").addEventListener("add-query:complete", complete)

    controller.connect()
    element.dispatchEvent(new CustomEvent("add-query:submit", {
      detail: { queryTexts: ["star wars", "dune"] }
    }))
    await Promise.resolve()

    expect(addQueries).toHaveBeenCalledWith(["star wars", "dune"])
    expect(window.quepidDom.flash.show).toHaveBeenCalledWith("success", "Queries added successfully.")
    expect(complete).toHaveBeenCalledOnce()
    expect(complete.mock.calls[0][0].detail).toEqual({ success: true })
    controller.disconnect()
  })

  it("reports search errors but completes the persisted workflow", async () => {
    const addQueries = vi.fn().mockResolvedValue({ searchError: new Error("timeout") })
    const { controller, element } = controllerFor(addQueries)

    controller.connect()
    element.dispatchEvent(new CustomEvent("add-query:submit", {
      detail: { queryTexts: ["star wars"] }
    }))
    await Promise.resolve()

    expect(window.quepidDom.flash.show).toHaveBeenNthCalledWith(1, "error", "Your new query had an error!")
    expect(window.quepidDom.flash.show).toHaveBeenNthCalledWith(2, "error", "timeout", "search-error")
    controller.disconnect()
  })

  it("reports persistence failures and marks the form unsuccessful", async () => {
    const addQueries = vi.fn().mockRejectedValue({ error: "Unable to add query." })
    const { controller, element } = controllerFor(addQueries)
    const complete = vi.fn()
    element.querySelector("form").addEventListener("add-query:complete", complete)

    controller.connect()
    element.dispatchEvent(new CustomEvent("add-query:submit", {
      detail: { queryTexts: ["star wars"] }
    }))
    await Promise.resolve()

    expect(window.quepidDom.flash.show).toHaveBeenCalledWith("error", "Unable to add query.")
    expect(complete.mock.calls[0][0].detail).toEqual({ success: false })
    controller.disconnect()
  })

  it("fails cleanly when the Angular adapter is unavailable", async () => {
    const { controller, element } = controllerFor(null)
    const complete = vi.fn()
    element.querySelector("form").addEventListener("add-query:complete", complete)

    controller.connect()
    element.dispatchEvent(new CustomEvent("add-query:submit", {
      detail: { queryTexts: ["star wars"] }
    }))
    await Promise.resolve()

    expect(window.quepidDom.flash.show).toHaveBeenCalledWith("error", "Unable to add queries.")
    expect(complete.mock.calls[0][0].detail).toEqual({ success: false })
    controller.disconnect()
  })
})
