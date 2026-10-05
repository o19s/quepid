import { coreWorkspace } from "core_runtime"
import { getCoreCapabilitiesOverride } from "utils/core_test_overrides"

// The core entry owns one module instance for the whole case workspace. Keep
// this accessor as a named capability boundary so controllers do not become
// coupled to the runtime's internal object shape.
export function getCoreCapabilities() {
  return getCoreCapabilitiesOverride() || coreWorkspace
}
