import { createFetchClient, createWiredServices } from "splainer-search/wired.js"

/**
 * Build the wired Splainer service graph for the case runtime.
 *
 * Case consumers subscribe to explicit stores/events, so native promises are
 * the correct contract and the graph needs no framework-specific adapter.
 */
export function createSplainerSearchRuntime({
  client = createFetchClient({ credentials: "include" }),
  wire = createWiredServices
} = {}) {
  const services = wire(client)
  return {
    services,
    docResolverSvc: services.docResolverSvc
  }
}
