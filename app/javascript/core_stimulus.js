/**
 * Slim Stimulus entry for the Angular core case layout (`core.html.erb`).
 *
 * Registers only the controllers `core.html.erb` actually renders, instead of
 * `controllers/index.js`'s `eagerLoadControllersFrom` (which would import every
 * pinned controller, Rails-only ones like `confetti_controller.js` included) on
 * this already-heavy Angular surface.
 */
import { application } from "controllers/application"
import ShareCaseCoreController from "controllers/share_case_core_controller"
import DeleteCaseOptionsCoreController from "controllers/delete_case_options_core_controller"
import BsTooltipController from "controllers/bs_tooltip_controller"
import BsPopoverController from "controllers/bs_popover_controller"

application.register("share-case-core", ShareCaseCoreController)
application.register("delete-case-options-core", DeleteCaseOptionsCoreController)
application.register("bs-tooltip", BsTooltipController)
application.register("bs-popover", BsPopoverController)
