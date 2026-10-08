// Document-level event contracts are documented in DEVELOPER_GUIDE.md#core-event-bus.
export const CORE_EVENTS = Object.freeze({
  CORE_BOOTSTRAP_FAILED: "core-bootstrap:failed",
  CASE_SELECTED: "quepid:case-selected",
  CASE_RENAMED: "quepid:case-renamed",
  CASE_HEADER_STALE: "quepid:case-header-stale",
  CASE_TEAM_CHANGED: "quepid:case-team-changed",
  CASE_SETTINGS_UPDATED: "case-settings:updated",
  PICK_SCORER_SELECTED: "pick-scorer:selected",
  QUERY_OPTIONS_SAVED: "query-options:saved",
  JUDGEMENTS_QUERIES_NEED_RELOAD: "judgements:queries-need-reload",
  IMPORTS_QUERIES_NEED_RELOAD: "imports:queries-need-reload",
  CASE_BOOK_UPDATED: "quepid:case-book-updated",
  QUERIES_STATE_CHANGED: "queries-state:changed",
  QUERY_DIFFS_REFRESHED: "query-diffs:refreshed",
  CASE_SCORE_PERSISTED: "case-score:persisted",
  ANNOTATIONS_CHANGED: "annotations:changed",
  FLASH_SHOW: "flash:show",
  FLASH_HIDE: "flash:hide"
})
