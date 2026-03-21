import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { Application } from "@hotwired/stimulus"
import AddQueryController from "../../../app/javascript/controllers/add_query_controller"
import { waitForController } from "./stimulus_helpers"

describe("waitForController", () => {
  let application

  beforeEach(async () => {
    document.head.innerHTML = '<meta name="csrf-token" content="x">'
    document.body.innerHTML = `
      <form data-controller="add-query"
            data-add-query-url-value="api/cases/1/queries"
            data-add-query-bulk-url-value="api/bulk/cases/1/queries"
            data-action="submit->add-query#submit">
        <input data-add-query-target="input" type="text" />
      </form>
    `
    application = Application.start()
    application.register("add-query", AddQueryController)
  })

  afterEach(() => {
    application.stop()
  })

  it("resolves once Stimulus has connected the controller", async () => {
    await waitForController(application, '[data-controller="add-query"]', "add-query")
    const c = application.getControllerForElementAndIdentifier(
      document.querySelector('[data-controller="add-query"]'),
      "add-query",
    )
    expect(c).not.toBeNull()
  })
})
