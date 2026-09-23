import { describe, expect, it, vi } from "vitest"
import QueryLifecycleController from "controllers/query_lifecycle_controller"

function controllerFor({ persistQuery, persistQueries, prepareQueries, commitQueries }) {
  const element = document.createElement("div")
  element.innerHTML = '<form data-controller="add-query"></form>'
  const controller = new QueryLifecycleController(element)
  controller.element = element
  window.quepidSearch = {
    queryLifecycle: { persistQuery, persistQueries, prepareQueries, commitQueries }
  }
  window.quepidDom = { flash: { show: vi.fn() } }
  return { controller, element }
}

describe("query_lifecycle_controller", () => {
  it("runs the add-query workflow and completes the form", async () => {
    const prepareQueries = vi.fn().mockReturnValue({ query: {} })
    const persistQueries = vi.fn().mockResolvedValue({ status: 201, data: {} })
    const commitQueries = vi.fn().mockResolvedValue({})
    const { controller, element } = controllerFor({ prepareQueries, persistQueries, commitQueries })
    const complete = vi.fn()
    element.querySelector("form").addEventListener("add-query:complete", complete)

    controller.connect()
    element.dispatchEvent(new CustomEvent("add-query:submit", {
      detail: { queryTexts: ["star wars", "dune"] }
    }))
    await Promise.resolve()
    await Promise.resolve()

    expect(prepareQueries).toHaveBeenCalledWith(["star wars", "dune"])
    expect(persistQueries).toHaveBeenCalledWith(undefined, ["star wars", "dune"])
    expect(commitQueries).toHaveBeenCalledWith({ query: {} }, { status: 201, data: {} })
    expect(window.quepidDom.flash.show).toHaveBeenCalledWith("success", "Queries added successfully.")
    expect(complete).toHaveBeenCalledOnce()
    expect(complete.mock.calls[0][0].detail).toEqual({ success: true })
    controller.disconnect()
  })

  it("reports search errors but completes the persisted workflow", async () => {
    const prepareQueries = vi.fn().mockReturnValue({ query: {} })
    const persistQuery = vi.fn().mockResolvedValue({ status: 201, data: {} })
    const commitQueries = vi.fn().mockResolvedValue({ searchError: new Error("timeout") })
    const { controller, element } = controllerFor({ prepareQueries, persistQuery, commitQueries })

    controller.connect()
    element.dispatchEvent(new CustomEvent("add-query:submit", {
      detail: { queryTexts: ["star wars"] }
    }))
    await Promise.resolve()
    await Promise.resolve()

    expect(window.quepidDom.flash.show).toHaveBeenNthCalledWith(1, "error", "Your new query had an error!")
    expect(window.quepidDom.flash.show).toHaveBeenNthCalledWith(2, "error", "timeout", "search-error")
    controller.disconnect()
  })

  it("reports persistence failures and marks the form unsuccessful", async () => {
    const prepareQueries = vi.fn().mockReturnValue({ query: {} })
    const persistQuery = vi.fn().mockRejectedValue({ error: "Unable to add query." })
    const commitQueries = vi.fn()
    const { controller, element } = controllerFor({ prepareQueries, persistQuery, commitQueries })
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
    const { controller, element } = controllerFor({})
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
