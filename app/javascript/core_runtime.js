import quepidSearch from "quepid_search"
import quepidStore from "quepid_store"
import { createSplainerSearchRuntime } from "utils/splainer_search_runtime"

const splainerSearch = createSplainerSearchRuntime()

quepidSearch.splainerSearch = splainerSearch.services
quepidSearch.docResolverSvc = splainerSearch.docResolverSvc

document.addEventListener("quepid:case-selected", (event) => {
  Object.assign(quepidSearch.caseState, event.detail || {})
})

document.addEventListener("judgements:book-settings-saved", (event) => {
  const detail = event.detail || {}
  if (Number(detail.caseId) !== Number(quepidSearch.caseState.caseNo)) return
  quepidSearch.caseState.bookId = detail.bookId ?? null
  quepidSearch.caseState.bookName = detail.bookName ?? null
})

export { quepidSearch, quepidStore }
