import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createBsModal, getOrCreateBsModal, hideBsModal, showBsModal } from "./bs_modal"

describe("bs_modal", () => {
  let element

  beforeEach(() => {
    element = document.createElement("div")
    document.body.appendChild(element)

    window.bootstrap = {
      Modal: class ModalMock {
        constructor(el, config) {
          this.element = el
          this._config = config
          ModalMock.instances.set(el, this)
        }

        static getOrCreateInstance(el, config) {
          return ModalMock.instances.get(el) || new ModalMock(el, config)
        }

        show() {
          this._shown = true
        }

        hide() {
          this._shown = false
        }
      }
    }
    window.bootstrap.Modal.instances = new Map()
  })

  afterEach(() => {
    element.remove()
    delete window.bootstrap
  })

  it("creates a modal instance with options", () => {
    const instance = createBsModal(element, { backdrop: "static" })

    expect(instance).not.toBeNull()
    expect(instance._config).toEqual({ backdrop: "static" })
  })

  it("warns and returns null from createBsModal when bootstrap Modal is missing", () => {
    delete window.bootstrap.Modal
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    expect(createBsModal(element)).toBeNull()
    expect(warn).toHaveBeenCalled()
  })

  it("gets or creates a modal instance", () => {
    const instance = getOrCreateBsModal(element)

    expect(instance).not.toBeNull()
    expect(getOrCreateBsModal(element)).toBe(instance)
  })

  it("warns and returns null from getOrCreateBsModal when bootstrap Modal is missing", () => {
    delete window.bootstrap.Modal
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    expect(getOrCreateBsModal(element)).toBeNull()
    expect(warn).toHaveBeenCalled()
  })

  it("showBsModal shows the instance", () => {
    const instance = createBsModal(element)
    showBsModal(instance)
    expect(instance._shown).toBe(true)
  })

  it("showBsModal does nothing when the instance is missing", () => {
    expect(() => showBsModal(null)).not.toThrow()
  })

  it("hideBsModal hides the instance", () => {
    const instance = createBsModal(element)
    showBsModal(instance)
    hideBsModal(instance)
    expect(instance._shown).toBe(false)
  })

  it("hideBsModal does nothing when the instance is missing", () => {
    expect(() => hideBsModal(null)).not.toThrow()
  })
})
