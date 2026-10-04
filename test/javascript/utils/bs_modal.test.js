import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createBsModal, getOrCreateBsModal, hideBsModal, installModalEscapeFallback, showBsModal } from "utils/bs_modal"

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

  describe("installModalEscapeFallback", () => {
    let doc
    let received

    const addModal = () => {
      const modal = doc.createElement("div")
      modal.className = "modal show"
      modal.innerHTML = "<button type=\"button\">Pick</button>"
      modal.addEventListener("keydown", (event) => {
        if (event.key === "Escape") received.push(modal)
      })
      doc.body.appendChild(modal)
      return modal
    }
    const pressEscape = (target = doc.body) =>
      target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))

    beforeEach(() => {
      // A separate document keeps each test's listener from leaking into the next.
      doc = document.implementation.createHTMLDocument("")
      received = []
      installModalEscapeFallback(doc)
    })

    it("hands Escape to the open modal when focus has fallen back to the body", () => {
      const modal = addModal()
      pressEscape()
      expect(received).toEqual([modal])
    })

    it("picks the last shown modal, which is the topmost stacked one", () => {
      addModal()
      const inner = addModal()
      pressEscape()
      expect(received).toEqual([inner])
    })

    it("leaves Escape to Bootstrap when focus is still inside the modal", () => {
      const modal = addModal()
      const button = modal.querySelector("button")
      button.focus()
      pressEscape(button)
      expect(received).toEqual([modal])
    })

    it("ignores other keys and Escape with no open modal", () => {
      pressEscape()
      addModal()
      doc.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
      expect(received).toEqual([])
    })
  })
})
