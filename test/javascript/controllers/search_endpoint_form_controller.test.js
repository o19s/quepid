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

  return { apiMethod, proxyRequests }
}

describe("search_endpoint_form controller", () => {
  it("switches JSONP to GET when proxying is enabled", () => {
    const targets = buildTargets("JSONP", true)
    const controller = buildControllerFixture(SearchEndpointFormController, { targets })

    controller.forceGetIfJsonpAndProxied()

    expect(targets.apiMethod.value).toBe("GET")
  })

  it("leaves a non-JSONP method alone", () => {
    const targets = buildTargets("GET", true)
    const controller = buildControllerFixture(SearchEndpointFormController, { targets })

    controller.forceGetIfJsonpAndProxied()

    expect(targets.apiMethod.value).toBe("GET")
  })

  it("leaves JSONP alone while proxying is off", () => {
    const targets = buildTargets("JSONP", false)
    const controller = buildControllerFixture(SearchEndpointFormController, { targets })

    controller.forceGetIfJsonpAndProxied()

    expect(targets.apiMethod.value).toBe("JSONP")
  })
})
