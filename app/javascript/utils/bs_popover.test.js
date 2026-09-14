import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  POPOVER_SELECTOR,
  createBsPopover,
  normalizePopoverPlacement,
  parsePopoverTrigger,
  toBsPopoverTrigger
} from "./bs_popover"

describe("bs_popover", () => {
  let element
  let disposers

  // Wraps createBsPopover and tracks its dispose() so afterEach can always
  // tear down the document-level outsideClick listener, even for tests that
  // don't call dispose() themselves -- otherwise it leaks onto `document`
  // (shared across every test in this file) for the rest of the run.
  function createPopover(options) {
    const handle = createBsPopover(element, options)
    disposers.push(handle.dispose)
    return handle
  }

  beforeEach(() => {
    disposers = []
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
    disposers.forEach((dispose) => dispose())
    element.remove()
    delete window.bootstrap
  })

  it("exposes the selector matching all three popover directive attributes", () => {
    expect(POPOVER_SELECTOR).toContain("quepid-popover")
    expect(POPOVER_SELECTOR).toContain("quepid-popover-template")
    expect(POPOVER_SELECTOR).toContain("bs-static-popover")
  })

  it("maps uib trigger strings to BS5 triggers", () => {
    expect(parsePopoverTrigger("'mouseenter'")).toBe("mouseenter")
    expect(toBsPopoverTrigger("mouseenter")).toBe("hover focus")
    expect(toBsPopoverTrigger("outsideClick")).toBe("manual")
  })

  it("maps the remaining uib trigger strings to BS5 triggers", () => {
    expect(toBsPopoverTrigger("focus")).toBe("focus")
    expect(toBsPopoverTrigger("click")).toBe("click")
    expect(toBsPopoverTrigger(undefined)).toBe("click")
  })

  it("defaults an unset or blank trigger attribute to click", () => {
    expect(parsePopoverTrigger(undefined)).toBe("click")
    expect(parsePopoverTrigger("  'click'  ")).toBe("click")
  })

  it("keeps the directional half of compound placement", () => {
    expect(normalizePopoverPlacement("auto right")).toBe("right")
  })

  it("defaults placement to top when unset", () => {
    expect(normalizePopoverPlacement(undefined)).toBe("top")
  })

  it("creates a text popover with title and body", () => {
    const { instance, setBody } = createPopover({
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

  it("setTitle refreshes the rendered header content", () => {
    const { instance, setTitle } = createPopover({
      mode: "text",
      title: "Help",
      body: "Body text"
    })

    setTitle("New title")
    expect(instance._lastContent).toEqual({
      ".popover-header": "New title",
      ".popover-body": "Body text"
    })
  })

  it("renders no header (not a placeholder) once refreshed when no title was given", () => {
    const { instance, setBody } = createPopover({ body: "x" })

    setBody("y")
    expect(instance._lastContent[".popover-header"]).toBeNull()
  })

  it("defaults mode to text, so a body-only call renders that body as content", () => {
    const { instance } = createPopover({ body: "fallback text" })
    expect(instance._config.content).toBe("fallback text")
  })

  it("warns and returns a no-op handle when bootstrap Popover is missing", () => {
    delete window.bootstrap.Popover
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    const handle = createPopover({ body: "x" })
    expect(handle.instance).toBeNull()
    expect(warn).toHaveBeenCalled()
    expect(() => handle.showFromIsOpen(true)).not.toThrow()
  })

  it("defaults html to false when omitted", () => {
    const { instance } = createPopover({ body: "plain text" })
    expect(instance._config.html).toBe(false)
  })

  it("uses a single space (not empty) for title/content when none is given, since BS5 needs non-empty content to initialize", () => {
    const { instance } = createPopover({})
    expect(instance._config.title).toBe(" ")
    expect(instance._config.content).toBe(" ")
    expect(instance._config.container).toBe("body")
    expect(instance._config.animation).toBe(false)
  })

  it("converts a numeric delayMs into BS5's { show, hide } delay shape", () => {
    const { instance } = createPopover({ body: "x", delayMs: 300 })
    expect(instance._config.delay).toEqual({ show: 300, hide: 0 })
  })

  describe("outsideClick trigger", () => {
    it("wires its own click toggle when hasNgClick is not set", () => {
      const { instance } = createPopover({
        trigger: "outsideClick",
        body: "x"
      })

      // outsideClick always drives visibility manually -- BS5's own hover/click
      // triggers must be off, or they'd fight with the click toggle below.
      expect(instance._config.trigger).toBe("manual")

      element.dispatchEvent(new MouseEvent("click", { bubbles: true }))

      expect(instance._visible).toBe(true)
    })

    it("does not wire its own click toggle when hasNgClick is set (caller owns the click)", () => {
      const { instance } = createPopover({
        trigger: "outsideClick",
        hasNgClick: true,
        body: "x"
      })

      element.dispatchEvent(new MouseEvent("click", { bubbles: true }))

      expect(instance._visible).toBeUndefined()
    })

    it("toggles via setIsOpen, not instance.toggle, when popover-is-open is bound", () => {
      const setIsOpen = vi.fn()
      createPopover({
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

      const { instance } = createPopover({
        trigger: "outsideClick",
        body: "x"
      })
      instance._visible = true

      document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }))

      expect(instance._visible).toBe(false)
      tip.remove()
    })

    it("does not hide when the click lands inside its own rendered tip", () => {
      const tip = document.createElement("div")
      tip.id = "test-tip-inside"
      const tipChild = document.createElement("button")
      tip.appendChild(tipChild)
      document.body.appendChild(tip)
      element.setAttribute("aria-describedby", "test-tip-inside")

      const { instance } = createPopover({
        trigger: "outsideClick",
        body: "x"
      })
      instance._visible = true

      tipChild.dispatchEvent(new MouseEvent("click", { bubbles: true }))

      expect(instance._visible).toBe(true)
      tip.remove()
    })

    it("routes an outside click through setIsOpen when popover-is-open is bound", () => {
      const tip = document.createElement("div")
      tip.id = "test-tip-2"
      document.body.appendChild(tip)
      element.setAttribute("aria-describedby", "test-tip-2")

      const setIsOpen = vi.fn()
      createPopover({
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
      const { instance } = createPopover({
        trigger: "outsideClick",
        hasNgClick: true, // isolate the document handler from the element's own click handler
        body: "x"
      })
      instance._visible = true

      document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }))

      expect(instance._visible).toBe(true)
    })
  })

  describe("non-outsideClick triggers", () => {
    it("does not register a document click listener (only outsideClick needs one)", () => {
      const addSpy = vi.spyOn(document, "addEventListener")
      createPopover({ trigger: "click", body: "x" })

      expect(addSpy).not.toHaveBeenCalledWith("click", expect.anything(), true)
      addSpy.mockRestore()
    })

    it("does not toggle on its own click (BS5's native click trigger owns that)", () => {
      const { instance } = createPopover({ trigger: "click", body: "x" })

      element.dispatchEvent(new MouseEvent("click", { bubbles: true }))

      expect(instance._visible).toBeUndefined()
    })
  })

  describe("popover-is-open two-way binding", () => {
    it("showFromIsOpen shows/hides the underlying instance", () => {
      const { instance, showFromIsOpen } = createPopover({ body: "x" })

      showFromIsOpen(true)
      expect(instance._visible).toBe(true)

      showFromIsOpen(false)
      expect(instance._visible).toBe(false)
    })

    it("reflects a user-driven show back through setIsOpen", () => {
      const setIsOpen = vi.fn()
      const { instance } = createPopover({
        hasIsOpen: true,
        getIsOpen: () => false,
        setIsOpen,
        body: "x"
      })

      // hasIsOpen also forces manual mode, so BS5 never opens the popover on
      // its own -- only our setIsOpen-driven showFromIsOpen may.
      expect(instance._config.trigger).toBe("manual")

      element.dispatchEvent(new Event("shown.bs.popover"))

      expect(setIsOpen).toHaveBeenCalledWith(true)
    })

    it("reflects a user-driven hide back through setIsOpen", () => {
      const setIsOpen = vi.fn()
      createPopover({
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
      createPopover({
        hasIsOpen: true,
        getIsOpen: () => true,
        setIsOpen,
        body: "x"
      })

      element.dispatchEvent(new Event("shown.bs.popover"))

      expect(setIsOpen).not.toHaveBeenCalled()
    })

    it("does not call setIsOpen on hidden when the bound value is already closed (avoids redundant scope updates)", () => {
      const setIsOpen = vi.fn()
      createPopover({
        hasIsOpen: true,
        getIsOpen: () => false,
        setIsOpen,
        body: "x"
      })

      element.dispatchEvent(new Event("hidden.bs.popover"))

      expect(setIsOpen).not.toHaveBeenCalled()
    })

    it("does not wire the shown/hidden listeners at all when hasIsOpen is not set (nothing to echo back)", () => {
      const addSpy = vi.spyOn(element, "addEventListener")
      createPopover({ body: "x" })

      expect(addSpy).not.toHaveBeenCalledWith("shown.bs.popover", expect.anything())
      expect(addSpy).not.toHaveBeenCalledWith("hidden.bs.popover", expect.anything())
    })

    it("does not call setIsOpen for a showFromIsOpen-driven change (suppresses the echo)", () => {
      const setIsOpen = vi.fn()
      const { showFromIsOpen } = createPopover({
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

    it("resets suppress after showFromIsOpen, so a later user-driven change still calls setIsOpen", () => {
      const setIsOpen = vi.fn()
      const { showFromIsOpen } = createPopover({
        hasIsOpen: true,
        getIsOpen: () => false,
        setIsOpen,
        body: "x"
      })

      showFromIsOpen(true)
      showFromIsOpen(false)
      setIsOpen.mockClear()

      element.dispatchEvent(new Event("shown.bs.popover"))

      expect(setIsOpen).toHaveBeenCalledWith(true)
    })
  })

  describe("template mode", () => {
    it("invokes onTemplateShow when the popover is about to show", () => {
      const onTemplateShow = vi.fn()
      createPopover({
        mode: "template",
        onTemplateShow,
        body: "x"
      })

      element.dispatchEvent(new Event("show.bs.popover"))

      expect(onTemplateShow).toHaveBeenCalled()
    })

    it("does not wire a show listener in text mode", () => {
      const addSpy = vi.spyOn(element, "addEventListener")
      createPopover({ mode: "text", body: "x" })

      expect(addSpy).not.toHaveBeenCalledWith("show.bs.popover", expect.anything())
    })
  })

  describe("dispose", () => {
    it("disposes a plain popover (no outsideClick, hasIsOpen, or template mode) without throwing", () => {
      // This is the most common configuration in production (quepidPopover's
      // default hover/click popovers); none of the optional listeners below
      // are registered, so dispose() must not assume they exist.
      const { dispose } = createPopover({ body: "x" })

      expect(() => dispose()).not.toThrow()
      expect(window.bootstrap.Popover.getInstance(element)).toBeNull()
    })

    it("removes all registered listeners and disposes the underlying instance", () => {
      const tip = document.createElement("div")
      tip.id = "test-tip-3"
      document.body.appendChild(tip)
      element.setAttribute("aria-describedby", "test-tip-3")

      const setIsOpen = vi.fn()
      const { dispose } = createPopover({
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
