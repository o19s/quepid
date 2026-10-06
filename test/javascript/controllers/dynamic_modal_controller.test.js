import { buildControllerFixture } from "../support/controller_fixture"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import DynamicModalController from "controllers/dynamic_modal_controller"
import { openDynamicModal } from "utils/dynamic_modal"

let instance
function owner() {
  const modal = openDynamicModal({ html: "<p>Content</p>" })
  const controller = buildControllerFixture(DynamicModalController, {
    element: modal.element
  })
  controller.connect()
  return { ...modal, controller }
}
function shown(element) {
  element.dispatchEvent(new Event("shown.bs.modal"))
}
function hidden(element) {
  element.classList.remove("show")
  element.dispatchEvent(new Event("hidden.bs.modal"))
}

describe("DynamicModalController", () => {
  beforeEach(() => {
    window.bootstrap = { Modal: class {
      constructor(element) {
        instance = this
        this.element = element
        this.show = vi.fn(() => element.classList.add("show"))
        this.hide = vi.fn()
        this.dispose = vi.fn()
      }
    } }
  })
  afterEach(() => {
    document.body.replaceChildren()
    delete window.bootstrap
  })

  it("defers closing during the opening transition and tears down once hidden", () => {
    const modal = owner()
    modal.dispose()
    expect(instance.hide).not.toHaveBeenCalled()
    shown(modal.element)
    expect(instance.hide).toHaveBeenCalledOnce()
    hidden(modal.element)
    expect(instance.dispose).toHaveBeenCalledOnce()
    expect(modal.element.isConnected).toBe(false)
    modal.element.dispatchEvent(new Event("dynamic-modal:close"))
    hidden(modal.element)
    expect(instance.dispose).toHaveBeenCalledOnce()
  })

  it("finishes teardown when detached during the show transition", () => {
    const modal = owner()
    modal.element.remove()
    modal.controller.disconnect()
    shown(modal.element)
    expect(instance.hide).toHaveBeenCalledOnce()
    hidden(modal.element)
    expect(instance.dispose).toHaveBeenCalledOnce()
  })

  it("does not recreate the Bootstrap widget on reconnect during teardown", () => {
    const modal = owner()
    modal.controller.disconnect()
    modal.controller.connect()
    expect(instance.show).toHaveBeenCalledOnce()
    shown(modal.element)
    hidden(modal.element)
    expect(instance.dispose).toHaveBeenCalledOnce()
  })

  it("ignores a nested modal's shown and hidden events", () => {
    const modal = owner()
    const nested = document.createElement("div")
    modal.element.append(nested)
    nested.dispatchEvent(new Event("shown.bs.modal", { bubbles: true }))
    nested.dispatchEvent(new Event("hidden.bs.modal", { bubbles: true }))
    expect(instance.dispose).not.toHaveBeenCalled()
    expect(modal.element.isConnected).toBe(true)
  })

  it("honors disposal requested before Stimulus connects", () => {
    const modal = openDynamicModal({ html: "<p>Content</p>" })
    modal.dispose()
    const controller = buildControllerFixture(DynamicModalController, {
      element: modal.element
    })
    controller.connect()
    expect(instance.show).not.toHaveBeenCalled()
    expect(instance.dispose).toHaveBeenCalledOnce()
    expect(modal.element.isConnected).toBe(false)
  })
})
