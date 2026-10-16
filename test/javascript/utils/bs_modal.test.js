import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createBsModal, getOrCreateBsModal, hideBsModal, installModalEscapeFallback, installModalTabWrap, showBsModal } from "utils/bs_modal"

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

    it("replays early Escape once opening finishes, even before the modal has show", () => {
      const modal = addModal()
      modal.classList.remove("show")
      modal.dispatchEvent(new Event("show.bs.modal", { bubbles: true }))
      pressEscape()
      pressEscape()
      expect(received).toEqual([])
      modal.classList.add("show")
      modal.dispatchEvent(new Event("shown.bs.modal", { bubbles: true }))
      expect(received).toEqual([modal])
      modal.dispatchEvent(new Event("shown.bs.modal", { bubbles: true }))
      expect(received).toEqual([modal])
    })

    it("queues Escape only for the opening inner modal", () => {
      addModal()
      const inner = addModal()
      inner.dispatchEvent(new Event("show.bs.modal", { bubbles: true }))
      pressEscape()
      inner.dispatchEvent(new Event("shown.bs.modal", { bubbles: true }))
      expect(received).toEqual([inner])
    })

    it("does not retain a canceled opening", async () => {
      const modal = addModal()
      modal.addEventListener("show.bs.modal", event => event.preventDefault())
      modal.dispatchEvent(new Event("show.bs.modal", { bubbles: true, cancelable: true }))
      await Promise.resolve()
      pressEscape()
      expect(received).toEqual([modal])
    })

    it("does not intercept Escape for a modal detached while opening", () => {
      const modal = addModal()
      modal.dispatchEvent(new Event("show.bs.modal", { bubbles: true }))
      modal.remove()
      const next = addModal()
      pressEscape()
      expect(received).toEqual([next])
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

  describe("installModalTabWrap", () => {
    let doc
    let modal
    let first
    let last

    const pressTab = (target, shiftKey = false) => {
      const event = new KeyboardEvent("keydown", { key: "Tab", shiftKey, bubbles: true, cancelable: true })
      target.dispatchEvent(event)
      return event
    }

    beforeEach(() => {
      doc = document.implementation.createHTMLDocument("")
      installModalTabWrap(doc)
      modal = doc.createElement("div")
      modal.className = "modal show"
      modal.innerHTML =
        '<button id="first">A</button><button disabled>X</button><button id="last">B</button>'
      doc.body.appendChild(modal)
      first = modal.querySelector("#first")
      last = modal.querySelector("#last")
    })

    it("wraps Tab from the last control to the first", () => {
      last.focus()
      expect(pressTab(last).defaultPrevented).toBe(true)
      expect(doc.activeElement).toBe(first)
    })

    it("wraps Shift+Tab from the first control to the last", () => {
      first.focus()
      expect(pressTab(first, true).defaultPrevented).toBe(true)
      expect(doc.activeElement).toBe(last)
    })

    it("wraps Shift+Tab from the dialog container to the last control", () => {
      modal.tabIndex = -1
      modal.focus()
      expect(pressTab(modal, true).defaultPrevented).toBe(true)
      expect(doc.activeElement).toBe(last)
    })

    it("leaves Tab between inner controls to the browser", () => {
      first.focus()
      expect(pressTab(first).defaultPrevented).toBe(false)
    })

    it("ignores Tab outside an open modal", () => {
      const outside = doc.createElement("button")
      doc.body.appendChild(outside)
      expect(pressTab(outside).defaultPrevented).toBe(false)
    })
  })
})
