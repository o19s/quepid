import { createFetchClient, createWiredServices } from "splainer-search/wired.js"

/**
 * Build the wired Splainer service graph for the framework-free case runtime.
 *
 * The old adapter wrapped every client method in Angular `$q` only to trigger a
 * digest. Case consumers now subscribe to explicit stores/events, so native
 * promises are the correct contract and the graph no longer needs Angular DI.
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
