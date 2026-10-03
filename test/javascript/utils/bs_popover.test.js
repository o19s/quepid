import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createBsPopover } from "utils/bs_popover"

describe("bs_popover", () => {
  let element
  let disposers

  // Wraps createBsPopover and tracks its dispose() so afterEach can always
  // tear down the document-level outside-click listener, even for tests that
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
    disposers.forEach((dispose) => dispose())
    element.remove()
    delete window.bootstrap
  })

  it("passes native Bootstrap trigger and placement values through", () => {
    const { instance } = createPopover({ trigger: "hover focus", placement: "right", body: "Help" })
    expect(instance._config.trigger).toBe("hover focus")
    expect(instance._config.placement).toBe("right")
  })

  it("creates a text popover with title and body", () => {
    const { instance, setBody } = createPopover({
      trigger: "hover focus",
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

  it("renders a body-only call as content", () => {
    const { instance } = createPopover({ body: "fallback text" })
    expect(instance._config.content).toBe("fallback text")
  })

  it("warns and returns a no-op handle when bootstrap Popover is missing", () => {
    delete window.bootstrap.Popover
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    const handle = createPopover({ body: "x" })
    expect(handle.instance).toBeNull()
    expect(warn).toHaveBeenCalled()
    expect(() => handle.dispose()).not.toThrow()
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

  describe("outside-click trigger", () => {
    it("wires its own click toggle on the trigger", () => {
      const { instance } = createPopover({
        trigger: "outside-click",
        body: "x"
      })

      // outside-click always drives visibility manually -- BS5's own hover/click
      // triggers must be off, or they'd fight with the click toggle below.
      expect(instance._config.trigger).toBe("manual")

      element.dispatchEvent(new MouseEvent("click", { bubbles: true }))

      expect(instance._visible).toBe(true)
    })



    it("hides the popover on a click outside both the trigger and the rendered tip", () => {
      const tip = document.createElement("div")
      tip.id = "test-tip"
      document.body.appendChild(tip)
      element.setAttribute("aria-describedby", "test-tip")

      const { instance } = createPopover({
        trigger: "outside-click",
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
        trigger: "outside-click",
        body: "x"
      })
      instance._visible = true

      tipChild.dispatchEvent(new MouseEvent("click", { bubbles: true }))

      expect(instance._visible).toBe(true)
      tip.remove()
    })


    it("ignores a click when no tip is rendered yet (aria-describedby unset)", () => {
      const { instance } = createPopover({
        trigger: "outside-click",
        body: "x"
      })
      instance._visible = true

      document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }))

      expect(instance._visible).toBe(true)
    })
  })

  describe("non-outside-click triggers", () => {
    it("does not register a document click listener (only outside-click needs one)", () => {
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

  describe("dispose", () => {
    it("disposes a plain popover without throwing", () => {
      // This is the most common configuration in production (Stimulus's
      // default hover/click popovers); none of the optional listeners below
      // are registered, so dispose() must not assume they exist.
      const { dispose } = createPopover({ body: "x" })

      expect(() => dispose()).not.toThrow()
      expect(window.bootstrap.Popover.getInstance(element)).toBeNull()
    })

    it("removes outside-click listeners and disposes the instance", () => {
      const tip = document.createElement("div")
      tip.id = "test-dispose-tip"
      document.body.appendChild(tip)
      element.setAttribute("aria-describedby", tip.id)
      const { instance, dispose } = createPopover({ trigger: "outside-click", body: "x" })
      instance._visible = true
      dispose()
      document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      element.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      expect(instance._visible).toBe(true)
      expect(window.bootstrap.Popover.getInstance(element)).toBeNull()
      tip.remove()
    })
  })
})
