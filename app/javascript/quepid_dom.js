import {
  TOOLTIP_SELECTOR,
  createBsTooltip,
  disposeBsTooltip,
  hideTooltipsWithin,
  updateBsTooltipContent
} from "./utils/bs_tooltip"
import {
  POPOVER_SELECTOR,
  createBsPopover,
  normalizePopoverPlacement,
  parsePopoverTrigger,
  toBsPopoverTrigger
} from "./utils/bs_popover"
import { restoreModalBodyLock, showStackedModal } from "./utils/bs_modal"
import { attachTextPaste } from "./utils/text_paste"
import { animateCountUp, stopCountUp } from "./utils/count_up"
import { hideFlash, showFlash } from "./utils/flash"

/**
 * Shared DOM helpers for Bootstrap tooltips/popovers and paste handling.
 * Exposed on `window.quepidDom` for the concatenated Angular bundle
 * (`quepid_angular_app.js`); Stimulus controllers import the modules directly.
 */
const quepidDom = {
  tooltip: {
    selector: TOOLTIP_SELECTOR,
    create: createBsTooltip,
    updateContent: updateBsTooltipContent,
    dispose: disposeBsTooltip,
    hideWithin: hideTooltipsWithin
  },
  popover: {
    selector: POPOVER_SELECTOR,
    create: createBsPopover,
    parseTrigger: parsePopoverTrigger,
    toBsTrigger: toBsPopoverTrigger,
    normalizePlacement: normalizePopoverPlacement
  },
  textPaste: {
    attach: attachTextPaste
  },
  countUp: {
    animate: animateCountUp,
    stop: stopCountUp
  },
  flash: {
    show: showFlash,
    hide: hideFlash
  },
  modal: {
    showStacked: showStackedModal,
    restoreBodyLock: restoreModalBodyLock
  }
}

export default quepidDom
