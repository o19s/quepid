import { describe, expect, it, vi } from "vitest"
import QueryLifecycleController from "controllers/query_lifecycle_controller"

function controllerFor({ persistQuery, persistQueries, prepareQueries, commitQueries }) {
  const element = document.createElement("div")
  element.innerHTML = '<form data-controller="add-query"></form>'
  const controller = new QueryLifecycleController(element)
  controller.element = element
  controller.hasAddQueryTarget = true
  controller.addQueryTarget = element.querySelector("form")
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

    await controller.handleAddQueries(new CustomEvent("add-query:submit", {
      detail: { queryTexts: ["star wars", "dune"] }
    }))

    expect(prepareQueries).toHaveBeenCalledWith(["star wars", "dune"])
    expect(persistQueries).toHaveBeenCalledWith(undefined, ["star wars", "dune"])
    expect(commitQueries).toHaveBeenCalledWith({ query: {} }, { status: 201, data: {} })
    expect(window.quepidDom.flash.show).toHaveBeenCalledWith("success", "Queries added successfully.")
    expect(complete).toHaveBeenCalledOnce()
    expect(complete.mock.calls[0][0].detail).toEqual({ success: true })
  })

  it("reports search errors but completes the persisted workflow", async () => {
    const prepareQueries = vi.fn().mockReturnValue({ query: {} })
    const persistQuery = vi.fn().mockResolvedValue({ status: 201, data: {} })
    const commitQueries = vi.fn().mockResolvedValue({ searchError: new Error("timeout") })
    const { controller } = controllerFor({ prepareQueries, persistQuery, commitQueries })

    await controller.handleAddQueries(new CustomEvent("add-query:submit", {
      detail: { queryTexts: ["star wars"] }
    }))

    expect(window.quepidDom.flash.show).toHaveBeenNthCalledWith(1, "error", "Your new query had an error!")
    expect(window.quepidDom.flash.show).toHaveBeenNthCalledWith(2, "error", "timeout", "search-error")
  })

  it("reports a bulk search error without duplicating the collection store's own flash", async () => {
    const prepareQueries = vi.fn().mockReturnValue({ queries: [{}, {}] })
    const persistQueries = vi.fn().mockResolvedValue({ status: 201, data: {} })
    const commitQueries = vi.fn().mockResolvedValue({ searchError: new Error("timeout") })
    const { controller } = controllerFor({ prepareQueries, persistQueries, commitQueries })

    await controller.handleAddQueries(new CustomEvent("add-query:submit", {
      detail: { queryTexts: ["star wars", "dune"] }
    }))

    // svc.searchAll() (the bulk path) already reports this failure through the
    // query collection store's search-failed event, which queries_list_controller.js
    // flashes on the same sticky channel — a second write here would just race it.
    expect(window.quepidDom.flash.show).toHaveBeenCalledWith("error", "One (or many) of your new queries had an error!")
    expect(window.quepidDom.flash.show).not.toHaveBeenCalledWith("error", expect.anything(), "search-error")
  })

  it("reports persistence failures and marks the form unsuccessful", async () => {
    const prepareQueries = vi.fn().mockReturnValue({ query: {} })
    const persistQuery = vi.fn().mockRejectedValue({ error: "Unable to add query." })
    const commitQueries = vi.fn()
    const { controller, element } = controllerFor({ prepareQueries, persistQuery, commitQueries })
    const complete = vi.fn()
    element.querySelector("form").addEventListener("add-query:complete", complete)

    await controller.handleAddQueries(new CustomEvent("add-query:submit", {
      detail: { queryTexts: ["star wars"] }
    }))

    expect(window.quepidDom.flash.show).toHaveBeenCalledWith("error", "Unable to add query.")
    expect(complete.mock.calls[0][0].detail).toEqual({ success: false })
  })

  it("falls back to a generic message for a persistence failure with no usable error field", async () => {
    const prepareQueries = vi.fn().mockReturnValue({ queries: [{}, {}] })
    const persistQueries = vi.fn().mockRejectedValue({ foo: "bar" })
    const commitQueries = vi.fn()
    const { controller } = controllerFor({ prepareQueries, persistQueries, commitQueries })

    await controller.handleAddQueries(new CustomEvent("add-query:submit", {
      detail: { queryTexts: ["star wars", "dune"] }
    }))

    expect(window.quepidDom.flash.show).toHaveBeenCalledWith("error", "Unable to add queries.")
  })

  it("fails cleanly when the adapter is unavailable", async () => {
    const { controller, element } = controllerFor({})
    const complete = vi.fn()
    element.querySelector("form").addEventListener("add-query:complete", complete)

    await controller.handleAddQueries(new CustomEvent("add-query:submit", {
      detail: { queryTexts: ["star wars"] }
    }))

    expect(window.quepidDom.flash.show).toHaveBeenCalledWith("error", "Unable to add queries.")
    expect(complete.mock.calls[0][0].detail).toEqual({ success: false })
  })
})
