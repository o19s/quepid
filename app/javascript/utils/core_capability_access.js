// The remaining legacy case runtime is published on window until its final
// consumers move into the framework-free case entry bundle. Keep that
// compatibility lookup in one boundary so modern controllers do not become
// service locators again.
export function getCoreCapabilities() {
  if (typeof window === "undefined") return {}
  return window.quepidSearch || {}
}
