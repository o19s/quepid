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
    document.querySelectorAll(".tooltip").forEach(el => el.remove())
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

  it("updates content via setContent", () => {
    const instance = createBsTooltip(element, { title: "Original" })
    updateBsTooltipContent(instance, "Updated")
    expect(instance._lastContent).toEqual({ ".tooltip-inner": "Updated" })
  })

  it("disposes the instance", () => {
    const instance = createBsTooltip(element, { title: "x" })
    disposeBsTooltip(instance)
    expect(window.bootstrap.Tooltip.getInstance(element)).toBeNull()
  })

  it("hideTooltipsWithin hides open tooltips matching the selector", () => {
    element.setAttribute("quepid-tooltip", "tip")
    const instance = createBsTooltip(element, { title: "x" })
    const hideSpy = vi.spyOn(instance, "hide")

    hideTooltipsWithin(document.body)
    expect(hideSpy).toHaveBeenCalled()
    expect(TOOLTIP_SELECTOR).toContain("quepid-tooltip")
  })
})
