import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { Application } from "@hotwired/stimulus"
import DeleteCaseOptionsController from "../../../app/javascript/controllers/delete_case_options_controller"
import { waitForController } from "../support/stimulus_helpers"

describe("DeleteCaseOptionsController", () => {
  let application
  const originalFetch = global.fetch

  beforeEach(async () => {
    document.head.innerHTML = '<meta name="csrf-token" content="test-csrf">'
    document.body.setAttribute("data-quepid-root-url", "")
    document.body.setAttribute("data-case-id", "42")

    document.body.innerHTML = `
      <div data-controller="delete-case-options">
        <a href="#" data-action="click->delete-case-options#open">Delete</a>

        <div class="modal fade" tabindex="-1" data-delete-case-options-target="modal">
          <button type="button" class="btn btn-outline-secondary"
                  data-delete-case-options-target="actionButton"
                  data-option-name="delete_all_queries"
                  data-action="click->delete-case-options#selectAction">
            Delete All Queries
          </button>
          <button type="button" class="btn btn-outline-secondary"
                  data-delete-case-options-target="actionButton"
                  data-option-name="archive_case"
                  data-action="click->delete-case-options#selectAction">
            Archive Case
          </button>
          <button type="button" class="btn btn-outline-secondary"
                  data-delete-case-options-target="actionButton"
                  data-option-name="delete_case"
                  data-action="click->delete-case-options#selectAction">
            Delete Case
          </button>

          <div class="d-none" data-delete-case-options-target="description" data-for-action="delete_all_queries">
            Deleting all the queries will also delete your ratings.
          </div>
          <div class="d-none" data-delete-case-options-target="description" data-for-action="archive_case">
            Deep freeze this case.
          </div>
          <div class="d-none" data-delete-case-options-target="description" data-for-action="delete_case">
            Delete this case forever.
          </div>

          <div class="alert d-none" data-delete-case-options-target="errorMessage"></div>

          <button type="button" class="btn btn-danger" disabled
                  data-delete-case-options-target="confirmButton"
                  data-action="click->delete-case-options#confirm">
            <span data-delete-case-options-target="confirmLabel">Confirm</span>
          </button>
        </div>
      </div>
    `

    window.bootstrap = {
      Modal: {
        getOrCreateInstance: vi.fn(() => ({
          show: vi.fn(),
          hide: vi.fn(),
        })),
        getInstance: vi.fn(() => ({
          hide: vi.fn(),
        })),
      },
    }

    application = Application.start()
    application.register("delete-case-options", DeleteCaseOptionsController)
    await waitForController(
      application,
      '[data-controller="delete-case-options"]',
      "delete-case-options",
    )
  })

  afterEach(() => {
    if (application) application.stop()
    delete window.bootstrap
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  function getController() {
    const el = document.querySelector('[data-controller="delete-case-options"]')
    return application.getControllerForElementAndIdentifier(el, "delete-case-options")
  }

  it("opens modal and resets state", () => {
    const ctrl = getController()

    ctrl.open(new Event("click", { cancelable: true }))

    expect(window.bootstrap.Modal.getOrCreateInstance).toHaveBeenCalled()
    expect(ctrl.confirmButtonTarget.disabled).toBe(true)
    expect(ctrl.confirmLabelTarget.textContent).toBe("Confirm")
  })

  it("selects action and updates UI", () => {
    const ctrl = getController()
    const btn = document.querySelector('[data-option-name="delete_all_queries"]')

    ctrl.selectAction({ preventDefault: () => {}, currentTarget: btn })

    expect(ctrl.selectedAction).toBe("delete_all_queries")
    expect(btn.classList.contains("btn-primary")).toBe(true)
    expect(ctrl.confirmButtonTarget.disabled).toBe(false)
    expect(ctrl.confirmLabelTarget.textContent).toBe("Delete All Queries")

    // Check description visibility
    const visibleDesc = document.querySelector('[data-for-action="delete_all_queries"]')
    expect(visibleDesc.classList.contains("d-none")).toBe(false)
    const hiddenDesc = document.querySelector('[data-for-action="archive_case"]')
    expect(hiddenDesc.classList.contains("d-none")).toBe(true)
  })

  it("switches between actions", () => {
    const ctrl = getController()
    const queriesBtn = document.querySelector('[data-option-name="delete_all_queries"]')
    const archiveBtn = document.querySelector('[data-option-name="archive_case"]')

    ctrl.selectAction({ preventDefault: () => {}, currentTarget: queriesBtn })
    ctrl.selectAction({ preventDefault: () => {}, currentTarget: archiveBtn })

    expect(ctrl.selectedAction).toBe("archive_case")
    expect(queriesBtn.classList.contains("btn-outline-secondary")).toBe(true)
    expect(archiveBtn.classList.contains("btn-primary")).toBe(true)
    expect(ctrl.confirmLabelTarget.textContent).toBe("Archive Case")
  })

  it("calls delete all queries API", async () => {
    const ctrl = getController()
    const btn = document.querySelector('[data-option-name="delete_all_queries"]')

    ctrl.selectAction({ preventDefault: () => {}, currentTarget: btn })

    global.fetch = vi.fn(() => Promise.resolve({ ok: true }))

    delete window.location
    window.location = { href: "", reload: vi.fn() }

    await ctrl.confirm(new Event("click", { cancelable: true }))

    expect(global.fetch).toHaveBeenCalledOnce()
    const [url, opts] = global.fetch.mock.calls[0]
    expect(url).toBe("api/bulk/cases/42/queries/delete")
    expect(opts.method).toBe("DELETE")
    expect(window.location.reload).toHaveBeenCalled()
  })

  it("calls delete case API and navigates to cases", async () => {
    const ctrl = getController()
    const btn = document.querySelector('[data-option-name="delete_case"]')

    ctrl.selectAction({ preventDefault: () => {}, currentTarget: btn })

    global.fetch = vi.fn(() => Promise.resolve({ ok: true }))

    delete window.location
    window.location = { href: "" }

    await ctrl.confirm(new Event("click", { cancelable: true }))

    expect(global.fetch).toHaveBeenCalledOnce()
    const [url, opts] = global.fetch.mock.calls[0]
    expect(url).toBe("api/cases/42")
    expect(opts.method).toBe("DELETE")
    expect(window.location.href).toBe("cases")
  })

  it("calls archive case endpoint and navigates", async () => {
    const ctrl = getController()
    const btn = document.querySelector('[data-option-name="archive_case"]')

    ctrl.selectAction({ preventDefault: () => {}, currentTarget: btn })

    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, redirected: true, url: "/cases" }),
    )

    delete window.location
    window.location = { href: "" }

    await ctrl.confirm(new Event("click", { cancelable: true }))

    expect(global.fetch).toHaveBeenCalledOnce()
    const [url, opts] = global.fetch.mock.calls[0]
    expect(url).toBe("cases/42/archive")
    expect(opts.method).toBe("POST")
    expect(window.location.href).toBe("/cases")  // redirected URL from server
  })

  it("shows error on API failure", async () => {
    const ctrl = getController()
    const btn = document.querySelector('[data-option-name="delete_case"]')

    ctrl.selectAction({ preventDefault: () => {}, currentTarget: btn })

    global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 500 }))

    await ctrl.confirm(new Event("click", { cancelable: true }))

    expect(ctrl.errorMessageTarget.classList.contains("d-none")).toBe(false)
    expect(ctrl.errorMessageTarget.textContent).toContain("500")
    expect(ctrl.confirmButtonTarget.disabled).toBe(false)
  })
})
