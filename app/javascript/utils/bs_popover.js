/**
 * Bootstrap 5 popover helpers shared by Angular quepidPopover / bsStaticPopover
 * and (future) Stimulus pages.
 *
 * Trigger mapping (uib → BS5) for Angular attrs:
 *   'mouseenter'   → hover focus
 *   'click'        → click
 *   'focus'        → focus
 *   'outsideClick' → manual + document capture listener
 */

export const POPOVER_SELECTOR =
  "[quepid-popover], [quepid-popover-template], [bs-static-popover]"

export function parsePopoverTrigger(raw) {
  if (!raw) return "click"
  return raw.trim().replace(/^['"]|['"]$/g, "")
}

export function toBsPopoverTrigger(trigger) {
  switch (trigger) {
    case "mouseenter":
      return "hover focus"
    case "focus":
      return "focus"
    case "click":
      return "click"
    case "outsideClick":
      return "manual"
    default:
      return "click"
  }
}

export function normalizePopoverPlacement(raw) {
  return (raw || "top").split(/\s+/).pop()
}

export function getBootstrapPopover() {
  return window.bootstrap && window.bootstrap.Popover
}

/**
 * Wire a BS5 Popover on `element`. Angular template mode passes hooks via
 * `options`; Stimulus text mode uses static title/body values.
 *
 * @param {Element} element
 * @param {{
 *   mode?: "text" | "template",
 *   trigger?: string,
 *   placement?: string,
 *   delayMs?: number,
 *   title?: string,
 *   body?: string,
 *   html?: boolean,
 *   hasIsOpen?: boolean,
 *   hasNgClick?: boolean,
 *   getIsOpen?: () => boolean,
 *   setIsOpen?: (val: boolean) => void,
 *   onTemplateShow?: () => void,
 *   scopeApply?: (fn: () => void) => void
 * }} options
 * @returns {{ instance: import("bootstrap").Popover | null, dispose: () => void, setBody: (body: string | Element) => void, setTitle: (title: string) => void }}
 */
export function createBsPopover(element, options = {}) {
  const Popover = getBootstrapPopover()
  if (!Popover) {
    console.warn(
      "bs_popover: window.bootstrap.Popover not available; popover will not render",
      element
    )
    return {
      instance: null,
      dispose() {},
      setBody() {},
      setTitle() {},
      showFromIsOpen() {}
    }
  }

  const mode = options.mode || "text"
  const trigger = parsePopoverTrigger(options.trigger)
  const placement = normalizePopoverPlacement(options.placement)
  const delayMs = options.delayMs
  const hasIsOpen = !!options.hasIsOpen
  const getIsOpen = options.getIsOpen || (() => false)
  const setIsOpen = options.setIsOpen
  const scopeApply = options.scopeApply || ((fn) => fn())

  const bsTrigger =
    hasIsOpen || trigger === "outsideClick"
      ? "manual"
      : toBsPopoverTrigger(trigger)

  let currentTitle = options.title || ""
  let currentBody = mode === "text" ? options.body || "" : ""

  const instance = new Popover(element, {
    placement,
    trigger: bsTrigger,
    html: !!options.html,
    delay: Number.isFinite(delayMs) ? { show: delayMs, hide: 0 } : 0,
    container: "body",
    animation: false,
    title: " ",
    content: currentBody || " "
  })

  function refreshContent() {
    instance.setContent({
      ".popover-header": currentTitle || null,
      ".popover-body": currentBody || " "
    })
  }

  function setTitle(val) {
    currentTitle = val || ""
    refreshContent()
  }

  function setBody(val) {
    currentBody = val || ""
    refreshContent()
  }

  let onShow = null
  let onShown = null
  let onHidden = null

  if (mode === "template" && options.onTemplateShow) {
    onShow = () => {
      options.onTemplateShow()
    }
    element.addEventListener("show.bs.popover", onShow)
  }

  let suppress = false
  if (hasIsOpen && setIsOpen) {
    onShown = () => {
      if (suppress || getIsOpen() === true) return
      scopeApply(() => setIsOpen(true))
    }
    onHidden = () => {
      if (suppress || getIsOpen() === false) return
      scopeApply(() => setIsOpen(false))
    }
    element.addEventListener("shown.bs.popover", onShown)
    element.addEventListener("hidden.bs.popover", onHidden)
  }

  let docHandler = null
  if (trigger === "outsideClick") {
    docHandler = ev => {
      const tipId = element.getAttribute("aria-describedby")
      const tip = tipId ? document.getElementById(tipId) : null
      if (!tip) return
      if (element.contains(ev.target) || tip.contains(ev.target)) return

      if (hasIsOpen && setIsOpen) {
        scopeApply(() => setIsOpen(false))
      } else {
        instance.hide()
      }
    }
    document.addEventListener("click", docHandler, true)
  }

  let elClickHandler = null
  if (trigger === "outsideClick" && !options.hasNgClick) {
    elClickHandler =
      hasIsOpen && setIsOpen
        ? () => scopeApply(() => setIsOpen(!getIsOpen()))
        : () => instance.toggle()
    element.addEventListener("click", elClickHandler)
  }

  return {
    instance,
    setTitle,
    setBody,
    showFromIsOpen(val) {
      suppress = true
      if (val) instance.show()
      else instance.hide()
      suppress = false
    },
    dispose() {
      if (docHandler) document.removeEventListener("click", docHandler, true)
      if (elClickHandler) element.removeEventListener("click", elClickHandler)
      if (onShow) element.removeEventListener("show.bs.popover", onShow)
      if (onShown) element.removeEventListener("shown.bs.popover", onShown)
      if (onHidden) element.removeEventListener("hidden.bs.popover", onHidden)
      instance.dispose()
    }
  }
}
