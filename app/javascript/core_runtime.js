import quepidStore from "quepid_store"
import { createSplainerSearchRuntime } from "utils/splainer_search_runtime"
import { createCoreWorkspaceRuntime } from "utils/core_workspace_runtime"

// One complete workspace per document, constructed before Stimulus starts.
const coreWorkspace = createCoreWorkspaceRuntime({
  splainerSearch: createSplainerSearchRuntime().services,
  store: quepidStore
})

export { coreWorkspace, quepidStore }
