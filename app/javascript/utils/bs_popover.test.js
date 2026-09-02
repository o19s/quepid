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
          // animation:false means BS5 fires shown.bs.popover synchronously,
          // within the same call stack as show() -- mirror that here so
          // showFromIsOpen's suppress flag is actually exercised.
          this.element.dispatchEvent(new Event("shown.bs.popover"))
        }

        hide() {
          this._visible = false
          this.element.dispatchEvent(new Event("hidden.bs.popover"))
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

  describe("outsideClick trigger", () => {
    it("wires its own click toggle when hasNgClick is not set", () => {
      const { instance } = createBsPopover(element, {
        trigger: "outsideClick",
        body: "x"
      })

      element.dispatchEvent(new MouseEvent("click", { bubbles: true }))

      expect(instance._visible).toBe(true)
    })

    it("does not wire its own click toggle when hasNgClick is set (caller owns the click)", () => {
      const { instance } = createBsPopover(element, {
        trigger: "outsideClick",
        hasNgClick: true,
        body: "x"
      })

      element.dispatchEvent(new MouseEvent("click", { bubbles: true }))

      expect(instance._visible).toBeUndefined()
    })

    it("toggles via setIsOpen, not instance.toggle, when popover-is-open is bound", () => {
      const setIsOpen = vi.fn()
      createBsPopover(element, {
        trigger: "outsideClick",
        hasIsOpen: true,
        getIsOpen: () => false,
        setIsOpen,
        body: "x"
      })

      element.dispatchEvent(new MouseEvent("click", { bubbles: true }))

      expect(setIsOpen).toHaveBeenCalledWith(true)
    })

    it("hides the popover on a click outside both the trigger and the rendered tip", () => {
      const tip = document.createElement("div")
      tip.id = "test-tip"
      document.body.appendChild(tip)
      element.setAttribute("aria-describedby", "test-tip")

      const { instance } = createBsPopover(element, {
        trigger: "outsideClick",
        body: "x"
      })
      instance._visible = true

      document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }))

      expect(instance._visible).toBe(false)
      tip.remove()
    })

    it("routes an outside click through setIsOpen when popover-is-open is bound", () => {
      const tip = document.createElement("div")
      tip.id = "test-tip-2"
      document.body.appendChild(tip)
      element.setAttribute("aria-describedby", "test-tip-2")

      const setIsOpen = vi.fn()
      createBsPopover(element, {
        trigger: "outsideClick",
        hasIsOpen: true,
        getIsOpen: () => true,
        setIsOpen,
        body: "x"
      })

      document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }))

      expect(setIsOpen).toHaveBeenCalledWith(false)
      tip.remove()
    })

    it("ignores a click when no tip is rendered yet (aria-describedby unset)", () => {
      const { instance } = createBsPopover(element, {
        trigger: "outsideClick",
        hasNgClick: true, // isolate the document handler from the element's own click handler
        body: "x"
      })
      instance._visible = true

      document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }))

      expect(instance._visible).toBe(true)
    })
  })

  describe("popover-is-open two-way binding", () => {
    it("showFromIsOpen shows/hides the underlying instance", () => {
      const { instance, showFromIsOpen } = createBsPopover(element, { body: "x" })

      showFromIsOpen(true)
      expect(instance._visible).toBe(true)

      showFromIsOpen(false)
      expect(instance._visible).toBe(false)
    })

    it("reflects a user-driven show back through setIsOpen", () => {
      const setIsOpen = vi.fn()
      createBsPopover(element, {
        hasIsOpen: true,
        getIsOpen: () => false,
        setIsOpen,
        body: "x"
      })

      element.dispatchEvent(new Event("shown.bs.popover"))

      expect(setIsOpen).toHaveBeenCalledWith(true)
    })

    it("reflects a user-driven hide back through setIsOpen", () => {
      const setIsOpen = vi.fn()
      createBsPopover(element, {
        hasIsOpen: true,
        getIsOpen: () => true,
        setIsOpen,
        body: "x"
      })

      element.dispatchEvent(new Event("hidden.bs.popover"))

      expect(setIsOpen).toHaveBeenCalledWith(false)
    })

    it("does not call setIsOpen when the bound value already matches (avoids redundant scope updates)", () => {
      const setIsOpen = vi.fn()
      createBsPopover(element, {
        hasIsOpen: true,
        getIsOpen: () => true,
        setIsOpen,
        body: "x"
      })

      element.dispatchEvent(new Event("shown.bs.popover"))

      expect(setIsOpen).not.toHaveBeenCalled()
    })

    it("does not call setIsOpen for a showFromIsOpen-driven change (suppresses the echo)", () => {
      const setIsOpen = vi.fn()
      const { showFromIsOpen } = createBsPopover(element, {
        hasIsOpen: true,
        getIsOpen: () => false,
        setIsOpen,
        body: "x"
      })

      // showFromIsOpen(true) calls instance.show(), which -- like real BS5
      // with animation:false -- fires shown.bs.popover synchronously within
      // the same call. suppress must still be true at that point.
      showFromIsOpen(true)

      expect(setIsOpen).not.toHaveBeenCalled()
    })
  })

  describe("template mode", () => {
    it("invokes onTemplateShow when the popover is about to show", () => {
      const onTemplateShow = vi.fn()
      createBsPopover(element, {
        mode: "template",
        onTemplateShow,
        body: "x"
      })

      element.dispatchEvent(new Event("show.bs.popover"))

      expect(onTemplateShow).toHaveBeenCalled()
    })
  })

  describe("dispose", () => {
    it("removes all registered listeners and disposes the underlying instance", () => {
      const tip = document.createElement("div")
      tip.id = "test-tip-3"
      document.body.appendChild(tip)
      element.setAttribute("aria-describedby", "test-tip-3")

      const setIsOpen = vi.fn()
      const { dispose } = createBsPopover(element, {
        trigger: "outsideClick",
        hasIsOpen: true,
        getIsOpen: () => true,
        setIsOpen,
        body: "x"
      })

      dispose()

      document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      element.dispatchEvent(new Event("shown.bs.popover"))
      element.dispatchEvent(new Event("hidden.bs.popover"))

      expect(setIsOpen).not.toHaveBeenCalled()
      expect(window.bootstrap.Popover.getInstance(element)).toBeNull()
      tip.remove()
    })
  })
})
