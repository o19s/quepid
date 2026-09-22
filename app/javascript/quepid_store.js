import { caseScoreStore } from "./stores/case_score_store"

/**
 * Dual-run shadow stores for the case workspace's live state, built ahead of
 * Angular's digest being replaced (see
 * docs/todo/angularjs_removal_inventory.md § Re-render mechanism). Exposed on
 * `window.quepidStore` for the concatenated Angular bundle
 * (`quepid_angular_app.js`), same pattern as `window.quepidSearch` /
 * `window.quepidDom`; Stimulus controllers will import the store modules
 * directly once they start reading from them (step 4 onward).
 */
const quepidStore = {
  scoring: caseScoreStore
}

export default quepidStore
