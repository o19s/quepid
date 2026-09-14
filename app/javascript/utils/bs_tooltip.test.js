import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  TOOLTIP_SELECTOR,
  createBsTooltip,
  disposeBsTooltip,
  hideTooltipsWithin,
  updateBsTooltipContent
} from "./bs_tooltip"

describe("bs_tooltip", () => {
  let element

  beforeEach(() => {
    element = document.createElement("a")
    document.body.appendChild(element)

    window.bootstrap = {
      Tooltip: class TooltipMock {
        constructor(el, config) {
          this.element = el
          this._config = config
          TooltipMock.instances.set(el, this)
        }

        static getInstance(el) {
          return TooltipMock.instances.get(el) || null
        }

        setContent(map) {
          this._lastContent = map
        }

        hide() {
          this._hidden = true
        }

        dispose() {
          TooltipMock.instances.delete(this.element)
        }
      }
    }
    window.bootstrap.Tooltip.instances = new Map()
  })

  afterEach(() => {
    element.remove()
    delete window.bootstrap
    document.querySelectorAll(".tooltip").forEach((el) => el.remove())
  })

  it("creates a tooltip with placement, html, and delay options", () => {
    const instance = createBsTooltip(element, {
      title: "Some tip",
      placement: "left",
      html: true,
      delayMs: 500
    })

    expect(instance).not.toBeNull()
    expect(instance._config.title).toBe("Some tip")
    expect(instance._config.placement).toBe("left")
    expect(instance._config.html).toBe(true)
    expect(instance._config.delay).toEqual({ show: 500, hide: 0 })
  })

  it("warns and returns null when bootstrap Tooltip is missing", () => {
    delete window.bootstrap.Tooltip
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    expect(createBsTooltip(element, { title: "x" })).toBeNull()
    expect(warn).toHaveBeenCalled()
  })

  it("applies default placement, trigger, container, and animation when omitted", () => {
    const instance = createBsTooltip(element, {})

    expect(instance._config.title).toBe("")
    expect(instance._config.placement).toBe("top")
    expect(instance._config.trigger).toBe("hover focus")
    expect(instance._config.container).toBe("body")
    expect(instance._config.animation).toBe(false)
  })

  it("updates content via setContent", () => {
    const instance = createBsTooltip(element, { title: "Original" })
    updateBsTooltipContent(instance, "Updated")
    expect(instance._lastContent).toEqual({ ".tooltip-inner": "Updated" })
  })

  it("updateBsTooltipContent does nothing when the instance is missing", () => {
    // bs_tooltip_controller calls this on titleValueChanged even when
    // createBsTooltip returned null (bootstrap unavailable at connect time).
    expect(() => updateBsTooltipContent(null, "Updated")).not.toThrow()
  })

  it("disposes the instance", () => {
    const instance = createBsTooltip(element, { title: "x" })
    disposeBsTooltip(instance)
    expect(window.bootstrap.Tooltip.getInstance(element)).toBeNull()
  })

  it("disposeBsTooltip does nothing when the instance is missing", () => {
    expect(() => disposeBsTooltip(null)).not.toThrow()
  })

  it("hideTooltipsWithin hides open tooltips matching the selector", () => {
    element.setAttribute("quepid-tooltip", "tip")
    const instance = createBsTooltip(element, { title: "x" })
    const hideSpy = vi.spyOn(instance, "hide")

    hideTooltipsWithin(document.body)
    expect(hideSpy).toHaveBeenCalled()
    expect(TOOLTIP_SELECTOR).toContain("quepid-tooltip")
  })

  it("hideTooltipsWithin skips matching elements with no live tooltip instance", () => {
    element.setAttribute("quepid-tooltip", "tip")
    expect(() => hideTooltipsWithin(document.body)).not.toThrow()
  })

  it("hideTooltipsWithin does nothing when bootstrap Tooltip is missing", () => {
    delete window.bootstrap.Tooltip
    expect(() => hideTooltipsWithin(document.body)).not.toThrow()
  })
})
