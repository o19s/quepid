import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { openDynamicModal } from "utils/dynamic_modal"

describe("dynamic_modal", () => {
  beforeEach(() => {
    window.bootstrap = {
      Modal: class ModalMock {
        constructor(el, config) {
          this.element = el
          this._config = config
          ModalMock.instances.set(el, this)
        }

        show() {
          this._shown = true
          this.element.classList.add("show")
          const backdrop = document.createElement("div")
          backdrop.className = "modal-backdrop"
          document.body.appendChild(backdrop)
        }

        hide() {
          this._shown = false
          this.element.classList.remove("show")
          this.element.dispatchEvent(new Event("hidden.bs.modal"))
        }

        dispose() {
          this._disposed = true
        }
      }
    }
    window.bootstrap.Modal.instances = new Map()
  })

  afterEach(() => {
    delete window.bootstrap
    document.querySelectorAll(".modal, .modal-backdrop").forEach((el) => el.remove())
    document.body.classList.remove("modal-open")
  })

  it("builds a .modal > .modal-dialog > .modal-content wrapper with the given html and shows it", () => {
    const { element } = openDynamicModal({ html: "<p>hi</p>", size: "lg", windowClass: "doc-detailed-explain-modal" })

    expect(element.classList.contains("modal")).toBe(true)
    expect(element.classList.contains("doc-detailed-explain-modal")).toBe(true)
    expect(element.querySelector(".modal-dialog.modal-lg")).not.toBeNull()
    expect(element.querySelector(".modal-content").innerHTML).toBe("<p>hi</p>")
    expect(document.body.contains(element)).toBe(true)

    const instance = window.bootstrap.Modal.instances.get(element)
    expect(instance._shown).toBe(true)
  })

  it("omits the size class when no size is given", () => {
    const { element } = openDynamicModal({ html: "<p>hi</p>" })
    expect(element.querySelector(".modal-dialog").className).not.toMatch(/modal-(sm|lg|xl)/)
  })

  it("disposes the bootstrap instance and removes itself from the DOM when hidden", () => {
    const { element, dispose } = openDynamicModal({ html: "<p>hi</p>" })
    const instance = window.bootstrap.Modal.instances.get(element)

    dispose()

    expect(instance._disposed).toBe(true)
    expect(document.body.contains(element)).toBe(false)
  })

  it("tears down when bootstrap.Modal is unavailable instead of leaving an orphaned element shown", () => {
    delete window.bootstrap.Modal
    const { element } = openDynamicModal({ html: "<p>hi</p>" })

    expect(document.body.contains(element)).toBe(false)
  })

  it("bumps z-index for a modal opened while another is already showing (nested modals)", () => {
    const outer = document.createElement("div")
    outer.className = "modal show"
    document.body.appendChild(outer)
    const outerBackdrop = document.createElement("div")
    outerBackdrop.className = "modal-backdrop"
    document.body.appendChild(outerBackdrop)

    const { element } = openDynamicModal({ html: "<p>hi</p>" })

    expect(element.style.zIndex).toBe("1070")
    const backdrops = document.querySelectorAll(".modal-backdrop")
    expect(backdrops[backdrops.length - 1].style.zIndex).toBe("1060")
  })

  it("leaves z-index alone when it's the only modal showing", () => {
    const { element } = openDynamicModal({ html: "<p>hi</p>" })
    expect(element.style.zIndex).toBe("")
  })

  it("re-applies modal-open on body if another modal is still showing after this one closes", () => {
    const outer = document.createElement("div")
    outer.className = "modal show"
    document.body.appendChild(outer)

    const { dispose } = openDynamicModal({ html: "<p>hi</p>" })
    dispose()

    expect(document.body.classList.contains("modal-open")).toBe(true)
  })

  it("does not add modal-open when no other modal is showing after this one closes", () => {
    const { dispose } = openDynamicModal({ html: "<p>hi</p>" })
    dispose()

    expect(document.body.classList.contains("modal-open")).toBe(false)
  })
})
