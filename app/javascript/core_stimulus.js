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

application.register("share-case-core", ShareCaseCoreController)
