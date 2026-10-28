import { describe, expect, it } from "vitest"
import SearchEndpointFormController from "controllers/search_endpoint_form_controller"
import { buildControllerFixture } from "../support/controller_fixture"

function buildTargets(apiMethodValue, proxyChecked) {
  const apiMethod = document.createElement("select")
  apiMethod.innerHTML = '<option value="GET">GET</option><option value="JSONP">JSONP</option>'
  apiMethod.value = apiMethodValue

  const proxyRequests = document.createElement("input")
  proxyRequests.type = "checkbox"
  proxyRequests.checked = proxyChecked

  const jsonpProxyWarning = document.createElement("div")
  jsonpProxyWarning.classList.add("d-none")

  return { apiMethod, proxyRequests, jsonpProxyWarning }
}

describe("search_endpoint_form controller", () => {
  it("shows the warning when JSONP is selected and proxying is enabled", () => {
    const targets = buildTargets("JSONP", true)
    const controller = buildControllerFixture(SearchEndpointFormController, { targets })

    controller.toggleJsonpProxyWarning()

    expect(targets.jsonpProxyWarning.classList.contains("d-none")).toBe(false)
  })

  it("hides the warning for a non-JSONP method", () => {
    const targets = buildTargets("GET", true)
    const controller = buildControllerFixture(SearchEndpointFormController, { targets })

    controller.toggleJsonpProxyWarning()

    expect(targets.jsonpProxyWarning.classList.contains("d-none")).toBe(true)
  })

  it("hides the warning while proxying is off", () => {
    const targets = buildTargets("JSONP", false)
    const controller = buildControllerFixture(SearchEndpointFormController, { targets })

    controller.toggleJsonpProxyWarning()

    expect(targets.jsonpProxyWarning.classList.contains("d-none")).toBe(true)
  })

  it("does nothing when proxy requests is always required (no checkbox target)", () => {
    const targets = buildTargets("GET", false)
    delete targets.proxyRequests

    const controller = buildControllerFixture(SearchEndpointFormController, { targets })

    expect(() => controller.toggleJsonpProxyWarning()).not.toThrow()
  })
})
