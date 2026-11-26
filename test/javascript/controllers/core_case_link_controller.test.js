import { describe, expect, it } from "vitest"
import CoreCaseLinkController from "controllers/core_case_link_controller"
import { buildControllerFixture } from "../support/controller_fixture"

// happy-dom serves the test document from http://localhost:3000.
function connectLink(href, protocol) {
  const element = document.createElement("a")
  element.setAttribute("href", href)
  const controller = buildControllerFixture(CoreCaseLinkController, {
    element,
    values: { protocol }
  })
  controller.connect()
  return element.getAttribute("href")
}

describe("CoreCaseLinkController", () => {
  it("leaves a link alone when the page is already on the endpoint's protocol", () => {
    expect(window.location.protocol).toBe("http:")

    expect(connectLink("/case/223/try/1", "http")).toBe("/case/223/try/1")
  })

  it("switches to https on the page's host, on the default port", () => {
    expect(connectLink("/case/223/try/1", "https")).toBe(
      `https://${window.location.hostname}/case/223/try/1`
    )
  })

  it("ignores protocols other than http and https", () => {
    expect(connectLink("/case/223/try/1", "javascript")).toBe("/case/223/try/1")
  })
})
