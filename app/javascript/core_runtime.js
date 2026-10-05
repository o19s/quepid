import quepidSearch from "quepid_search"
import quepidStore from "quepid_store"
import { createSplainerSearchRuntime } from "utils/splainer_search_runtime"

const splainerSearch = createSplainerSearchRuntime()

quepidSearch.splainerSearch = splainerSearch.services
quepidSearch.docResolverSvc = splainerSearch.docResolverSvc

export { quepidSearch, quepidStore }
