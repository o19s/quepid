import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { Application } from "@hotwired/stimulus"
import ImportRatingsController from "../../../app/javascript/controllers/import_ratings_controller"
import { waitForController } from "../support/stimulus_helpers"

describe("ImportRatingsController", () => {
  let application

  beforeEach(async () => {
    document.head.innerHTML = '<meta name="csrf-token" content="test-csrf">'
    document.body.setAttribute("data-quepid-root-url", "")

    document.body.innerHTML = `
      <div data-controller="import-ratings"
           data-import-ratings-case-id-value="42">

        <a href="#" data-action="click->import-ratings#open">Import</a>

        <div class="modal fade" tabindex="-1" data-import-ratings-target="modal">
          <div class="modal-body">
            <input type="checkbox" data-import-ratings-target="clearQueriesCheckbox">
            <input type="checkbox" data-import-ratings-target="createQueriesCheckbox">

            <div class="mb-3">
              <input type="file" class="form-control" data-import-ratings-target="ratingsFileInput"
                     data-format="csv" data-action="change->import-ratings#fileSelected">
            </div>
            <div class="mb-3 d-none">
              <input type="file" class="form-control" data-import-ratings-target="ratingsFileInput"
                     data-format="rre" data-action="change->import-ratings#fileSelected">
            </div>
            <div class="mb-3 d-none">
              <input type="file" class="form-control" data-import-ratings-target="ratingsFileInput"
                     data-format="ltr" data-action="change->import-ratings#fileSelected">
            </div>

            <input type="file" class="form-control" data-import-ratings-target="informationNeedsFileInput"
                   data-action="change->import-ratings#fileSelected">

            <input type="file" class="form-control" data-import-ratings-target="snapshotFileInput"
                   data-action="change->import-ratings#fileSelected">

            <div class="alert d-none" data-import-ratings-target="alertArea"></div>
          </div>
          <div class="modal-footer">
            <button data-import-ratings-target="submitButton" disabled
                    data-action="click->import-ratings#submit">
              <span data-import-ratings-target="submitText">Import</span>
              <span data-import-ratings-target="spinner" class="d-none"></span>
            </button>
          </div>
        </div>
      </div>
    `

    // Mock Bootstrap Modal
    window.bootstrap = {
      Modal: {
        getOrCreateInstance: vi.fn(() => ({
          show: vi.fn(),
          hide: vi.fn(),
        })),
      },
    }

    application = Application.start()
    application.register("import-ratings", ImportRatingsController)
    await waitForController(application, "[data-controller='import-ratings']", "import-ratings")
  })

  afterEach(() => {
    application.stop()
    delete window.bootstrap
  })

  it("connects the controller", () => {
    const el = document.querySelector("[data-controller='import-ratings']")
    const controller = application.getControllerForElementAndIdentifier(el, "import-ratings")
    expect(controller).not.toBeNull()
  })

  it("opens the modal when open() is called", () => {
    const link = document.querySelector("a")
    link.click()
    expect(window.bootstrap.Modal.getOrCreateInstance).toHaveBeenCalled()
  })

  it("has submit button disabled initially", () => {
    const btn = document.querySelector("[data-import-ratings-target='submitButton']")
    expect(btn.disabled).toBe(true)
  })

  it("parses CSV lines with quoted fields", () => {
    const el = document.querySelector("[data-controller='import-ratings']")
    const controller = application.getControllerForElementAndIdentifier(el, "import-ratings")
    const result = controller._parseCSVLine('"star wars, the movie",doc123,3')
    expect(result).toEqual(["star wars, the movie", "doc123", "3"])
  })

  it("shows alert when no file is selected for ratings import", async () => {
    const el = document.querySelector("[data-controller='import-ratings']")
    const controller = application.getControllerForElementAndIdentifier(el, "import-ratings")

    controller._activeTab = "ratings"
    controller._activeFormat = "csv"

    await controller.submit(new Event("click", { cancelable: true }))

    const alert = document.querySelector("[data-import-ratings-target='alertArea']")
    expect(alert.classList.contains("d-none")).toBe(false)
    expect(alert.textContent).toContain("Please select a file")
  })

  it("shows alert when no file is selected for information needs import", async () => {
    const el = document.querySelector("[data-controller='import-ratings']")
    const controller = application.getControllerForElementAndIdentifier(el, "import-ratings")

    controller._activeTab = "information_needs"

    await controller.submit(new Event("click", { cancelable: true }))

    const alert = document.querySelector("[data-import-ratings-target='alertArea']")
    expect(alert.classList.contains("d-none")).toBe(false)
    expect(alert.textContent).toContain("Please select a file")
  })
})
