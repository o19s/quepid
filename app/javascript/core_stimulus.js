/**
 * Slim Stimulus entry for the Angular core case layout (`core.html.erb`).
 *
 * Registers only the controllers `core.html.erb` actually renders, instead of
 * `controllers/index.js`'s `eagerLoadControllersFrom` (which would import every
 * pinned controller, Rails-only ones like `confetti_controller.js` included) on
 * this already-heavy Angular surface.
 *
 * Turbo is loaded here for Turbo Frames only - the server-rendered case header
 * re-renders its frame on rename. Drive is switched off, as it is for the rest of
 * the app in `application_modern.js`, and that matters more on this page: Angular
 * runs `$locationProvider.html5Mode(true)`, so letting Turbo Drive intercept
 * navigation would put two routers on the same URL. Frames and Streams still work
 * with Drive off, because Turbo treats anything inside a <turbo-frame> as
 * navigatable regardless.
 */
import "@hotwired/turbo-rails"
import { application } from "controllers/application"
import CaseRenameController from "controllers/case_rename_controller"
import CaseToolbarController from "controllers/case_toolbar_controller"
import ShareCaseCoreController from "controllers/share_case_core_controller"
import DeleteCaseOptionsCoreController from "controllers/delete_case_options_core_controller"
import CloneCaseCoreController from "controllers/clone_case_core_controller"
import ExportCaseCoreController from "controllers/export_case_core_controller"
import PickScorerCoreController from "controllers/pick_scorer_core_controller"
import TakeSnapshotCoreController from "controllers/take_snapshot_core_controller"
import JudgementsCoreController from "controllers/judgements_core_controller"
import BsTooltipController from "controllers/bs_tooltip_controller"
import BsPopoverController from "controllers/bs_popover_controller"
import RatingPopoverController from "controllers/rating_popover_controller"
import QscoreQueryController from "controllers/qscore_query_controller"
import QscoreCaseController from "controllers/qscore_case_controller"
import QueryUnratedBadgeController from "controllers/query_unrated_badge_controller"
import QueryRowController from "controllers/query_row_controller"
import QueriesListController from "controllers/queries_list_controller"
import CountUpController from "controllers/count_up_controller"
import MatchExplainController from "controllers/match_explain_controller"
import QueryExplainController from "controllers/query_explain_controller"
import JsonExplorerController from "controllers/json_explorer_controller"
import SearchResultController from "controllers/search_result_controller"
import SearchResultsController from "controllers/search_results_controller"
import AddQueryController from "controllers/add_query_controller"
import QueryLifecycleController from "controllers/query_lifecycle_controller"
import QueryDeleteController from "controllers/query_delete_controller"
import MoveQueryCoreController from "controllers/move_query_core_controller"
import FlashController from "controllers/flash_controller"
import QueryNotesController from "controllers/query_notes_controller"
import AnnotationsController from "controllers/annotations_controller"

Turbo.session.drive = false

application.register("case-rename", CaseRenameController)
application.register("case-toolbar", CaseToolbarController)
application.register("share-case-core", ShareCaseCoreController)
application.register("delete-case-options-core", DeleteCaseOptionsCoreController)
application.register("clone-case-core", CloneCaseCoreController)
application.register("export-case-core", ExportCaseCoreController)
application.register("pick-scorer-core", PickScorerCoreController)
application.register("take-snapshot-core", TakeSnapshotCoreController)
application.register("judgements-core", JudgementsCoreController)
application.register("bs-tooltip", BsTooltipController)
application.register("bs-popover", BsPopoverController)
application.register("rating-popover", RatingPopoverController)
application.register("qscore-query", QscoreQueryController)
application.register("qscore-case", QscoreCaseController)
application.register("query-unrated-badge", QueryUnratedBadgeController)
application.register("query-row", QueryRowController)
application.register("queries-list", QueriesListController)
application.register("count-up", CountUpController)
application.register("match-explain", MatchExplainController)
application.register("query-explain", QueryExplainController)
application.register("json-explorer", JsonExplorerController)
application.register("search-result", SearchResultController)
application.register("search-results", SearchResultsController)
application.register("add-query", AddQueryController)
application.register("query-lifecycle", QueryLifecycleController)
application.register("query-delete", QueryDeleteController)
application.register("move-query-core", MoveQueryCoreController)
application.register("flash", FlashController)
application.register("query-notes", QueryNotesController)
application.register("annotations", AnnotationsController)
