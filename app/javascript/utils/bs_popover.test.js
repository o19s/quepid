import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  createBsPopover,
  normalizePopoverPlacement,
  parsePopoverTrigger,
  toBsPopoverTrigger
} from "./bs_popover"

describe("bs_popover", () => {
  let element

  beforeEach(() => {
    element = document.createElement("span")
    document.body.appendChild(element)

    window.bootstrap = {
      Popover: class PopoverMock {
        constructor(el, config) {
          this.element = el
          this._config = config
          PopoverMock.instances.set(el, this)
        }

        static getInstance(el) {
          return PopoverMock.instances.get(el) || null
        }

        setContent(map) {
          this._lastContent = map
        }

        show() {
          this._visible = true
        }

        hide() {
          this._visible = false
        }

        toggle() {
          this._visible = !this._visible
        }

        dispose() {
          PopoverMock.instances.delete(this.element)
        }
      }
    }
    window.bootstrap.Popover.instances = new Map()
  })

  afterEach(() => {
    element.remove()
    delete window.bootstrap
  })

  it("maps uib trigger strings to BS5 triggers", () => {
    expect(parsePopoverTrigger("'mouseenter'")).toBe("mouseenter")
    expect(toBsPopoverTrigger("mouseenter")).toBe("hover focus")
    expect(toBsPopoverTrigger("outsideClick")).toBe("manual")
  })

  it("keeps the directional half of compound placement", () => {
    expect(normalizePopoverPlacement("auto right")).toBe("right")
  })

  it("creates a text popover with title and body", () => {
    const { instance, setBody } = createBsPopover(element, {
      mode: "text",
      trigger: "mouseenter",
      placement: "right",
      title: "Help",
      body: "Body text",
      html: false
    })

    expect(instance).not.toBeNull()
    expect(instance._config.placement).toBe("right")
    expect(instance._config.trigger).toBe("hover focus")

    setBody("Updated body")
    expect(instance._lastContent).toEqual({
      ".popover-header": "Help",
      ".popover-body": "Updated body"
    })
  })

  it("warns and returns a no-op handle when bootstrap Popover is missing", () => {
    delete window.bootstrap.Popover
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    const handle = createBsPopover(element, { body: "x" })
    expect(handle.instance).toBeNull()
    expect(warn).toHaveBeenCalled()
    expect(() => handle.showFromIsOpen(true)).not.toThrow()
  })

  it("defaults html to false when omitted", () => {
    const { instance } = createBsPopover(element, { body: "plain text" })
    expect(instance._config.html).toBe(false)
  })
})
