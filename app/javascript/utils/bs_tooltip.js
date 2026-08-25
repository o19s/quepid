/**
 * Bootstrap 5 tooltip helpers shared by the Angular quepidTooltip directive,
 * Stimulus `bs-tooltip`, and quepidSortable (hide stuck tooltips mid-drag).
 */

// quepid-tooltip: Angular. [data-controller~="bs-tooltip"]: Stimulus (core drag safety net).
export const TOOLTIP_SELECTOR = '[quepid-tooltip], [data-controller~="bs-tooltip"]'

export function getBootstrapTooltip() {
  return window.bootstrap && window.bootstrap.Tooltip
}

/**
 * @param {Element} element
 * @param {{ title?: string, placement?: string, html?: boolean, delayMs?: number }} options
 * @returns {import("bootstrap").Tooltip | null}
 */
export function createBsTooltip(element, options = {}) {
  const Tooltip = getBootstrapTooltip()
  if (!Tooltip) {
    console.warn(
      "bs_tooltip: window.bootstrap.Tooltip not available; tooltip will not render",
      element
    )
    return null
  }

  const delayMs = options.delayMs
  return new Tooltip(element, {
    title: options.title || "",
    placement: options.placement || "top",
    html: !!options.html,
    trigger: "hover focus",
    delay: Number.isFinite(delayMs) ? { show: delayMs, hide: 0 } : 0,
    container: "body",
    animation: false
  })
}

/**
 * @param {import("bootstrap").Tooltip | null | undefined} instance
 * @param {string} title
 */
export function updateBsTooltipContent(instance, title) {
  if (!instance) return
  instance.setContent({ ".tooltip-inner": title || "" })
}

/**
 * @param {import("bootstrap").Tooltip | null | undefined} instance
 */
export function disposeBsTooltip(instance) {
  if (!instance) return
  instance.dispose()
}

/**
 * Hide any open BS5 tooltips within `root` (used during SortableJS drag).
 *
 * @param {ParentNode} root
 */
export function hideTooltipsWithin(root) {
  const Tooltip = getBootstrapTooltip()
  if (!Tooltip) return

  root.querySelectorAll(TOOLTIP_SELECTOR).forEach(el => {
    const instance = Tooltip.getInstance(el)
    if (instance) instance.hide()
  })
}
