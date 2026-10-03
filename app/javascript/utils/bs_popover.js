/** Bootstrap 5 popovers with optional outside-click dismissal. */

export function getBootstrapPopover() {
  return window.bootstrap && window.bootstrap.Popover
}

/**
 * @param {Element} element
 * @param {{ trigger?: string, placement?: string, delayMs?: number,
 *   title?: string, body?: string | Element, html?: boolean }} options
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
      setTitle() {}
    }
  }

  const trigger = options.trigger || "click"
  const placement = options.placement || "top"
  const delayMs = options.delayMs
  const bsTrigger = trigger === "outside-click" ? "manual" : trigger

  let currentTitle = options.title || ""
  let currentBody = options.body || ""

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

  // The constructor above only seeds BS5's internal template with " " for
  // title/content (a placeholder, not currentTitle/currentBody) - callers
  // that pass a real title/body at creation time (rather than only via a
  // later setTitle()/setBody(), as Stimulus value-changed callbacks do)
  // would otherwise render blank until something else calls one of those.
  refreshContent()

  function setTitle(val) {
    currentTitle = val || ""
    refreshContent()
  }

  function setBody(val) {
    currentBody = val || ""
    refreshContent()
  }

  let docHandler = null
  if (trigger === "outside-click") {
    docHandler = (ev) => {
      const tipId = element.getAttribute("aria-describedby")
      const tip = tipId ? document.getElementById(tipId) : null
      if (!tip) return
      if (element.contains(ev.target) || tip.contains(ev.target)) return

      instance.hide()
    }
    document.addEventListener("click", docHandler, true)
  }

  let elClickHandler = null
  if (trigger === "outside-click") {
    elClickHandler = () => instance.toggle()
    element.addEventListener("click", elClickHandler)
  }

  return {
    instance,
    setTitle,
    setBody,
    dispose() {
      if (docHandler) document.removeEventListener("click", docHandler, true)
      if (elClickHandler) element.removeEventListener("click", elClickHandler)
      instance.dispose()
    }
  }
}
