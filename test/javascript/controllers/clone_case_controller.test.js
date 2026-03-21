import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { Application } from "@hotwired/stimulus"
import CloneCaseController from "../../../app/javascript/controllers/clone_case_controller"
import { waitForController } from "../support/stimulus_helpers"

describe("CloneCaseController", () => {
  let application
  const originalFetch = global.fetch

  beforeEach(async () => {
    document.head.innerHTML = '<meta name="csrf-token" content="test-csrf">'
    document.body.setAttribute("data-quepid-root-url", "")

    document.body.innerHTML = `
      <div data-controller="clone-case"
           data-clone-case-case-id-value="42"
           data-clone-case-case-name-value="Test Case">

        <a href="#" data-action="click->clone-case#open">Clone</a>

        <div class="modal fade" tabindex="-1" data-clone-case-target="modal">
          <form data-action="submit->clone-case#submit">
            <input type="text" data-clone-case-target="nameInput" value="">
            <div class="d-none" data-clone-case-target="errorMessage"></div>
            <div class="d-none" data-clone-case-target="progressMessage"></div>
            <button type="submit" data-clone-case-target="submitButton">Clone</button>

            <button type="button" data-clone-case-target="historyToggle" data-history="false"
                    class="btn btn-primary" data-action="click->clone-case#toggleHistory">Specific try</button>
            <button type="button" data-clone-case-target="historyToggle" data-history="true"
                    class="btn btn-outline-secondary" data-action="click->clone-case#toggleHistory">All history</button>

            <div data-clone-case-target="trySelectGroup">
              <select data-clone-case-target="trySelect">
                <option value="1">Try 1</option>
                <option value="2" selected>Try 2</option>
              </select>
            </div>

            <input type="checkbox" data-clone-case-target="cloneQueries" checked>
            <input type="checkbox" data-clone-case-target="cloneRatings">
          </form>
        </div>
      </div>
    `

    window.bootstrap = {
      Modal: {
        getOrCreateInstance: vi.fn(() => ({
          show: vi.fn(),
          hide: vi.fn(),
        })),
      },
    }

    application = Application.start()
    application.register("clone-case", CloneCaseController)
    await waitForController(application, '[data-controller="clone-case"]', "clone-case")
  })

  afterEach(() => {
    if (application) application.stop()
    delete window.bootstrap
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it("submits clone request with correct payload", async () => {
    const el = document.querySelector('[data-controller="clone-case"]')
    const ctrl = application.getControllerForElementAndIdentifier(el, "clone-case")

    ctrl.nameInputTarget.value = "My Clone"

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ case_id: 99, last_try_number: 1 }),
      }),
    )

    // Prevent navigation
    delete window.location
    window.location = { href: "", pathname: "/case/42/try/1/new_ui" }

    await ctrl.submit(new Event("submit", { cancelable: true }))

    expect(global.fetch).toHaveBeenCalledOnce()
    const [url, opts] = global.fetch.mock.calls[0]
    expect(url).toBe("api/clone/cases")
    expect(opts.method).toBe("POST")

    const body = JSON.parse(opts.body)
    expect(body.case_id).toBe(42)
    expect(body.case_name).toBe("My Clone")
    expect(body.clone_queries).toBe(true)
    expect(body.clone_ratings).toBe(false)
    expect(body.preserve_history).toBe(false)
    expect(body.try_number).toBe(2) // selected try
  })

  it("sends preserve_history when history toggle is set", async () => {
    const el = document.querySelector('[data-controller="clone-case"]')
    const ctrl = application.getControllerForElementAndIdentifier(el, "clone-case")

    // Click "All history" toggle
    const historyBtn = document.querySelector('[data-history="true"]')
    ctrl.toggleHistory({ currentTarget: historyBtn })

    ctrl.nameInputTarget.value = "Full Clone"

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ case_id: 100, last_try_number: 3 }),
      }),
    )

    delete window.location
    window.location = { href: "", pathname: "/case/42/try/1/new_ui" }

    await ctrl.submit(new Event("submit", { cancelable: true }))

    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body.preserve_history).toBe(true)
    expect(body.try_number).toBeUndefined()
  })

  it("shows error when name is empty", async () => {
    const el = document.querySelector('[data-controller="clone-case"]')
    const ctrl = application.getControllerForElementAndIdentifier(el, "clone-case")

    ctrl.nameInputTarget.value = "  "

    await ctrl.submit(new Event("submit", { cancelable: true }))

    expect(ctrl.errorMessageTarget.classList.contains("d-none")).toBe(false)
    expect(ctrl.errorMessageTarget.textContent).toContain("required")
  })

  it("navigates to cloned case on success", async () => {
    const el = document.querySelector('[data-controller="clone-case"]')
    const ctrl = application.getControllerForElementAndIdentifier(el, "clone-case")

    ctrl.nameInputTarget.value = "Nav Clone"

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ case_id: 77, last_try_number: 5 }),
      }),
    )

    delete window.location
    window.location = { href: "", pathname: "/case/42/try/1/new_ui" }

    await ctrl.submit(new Event("submit", { cancelable: true }))

    expect(window.location.href).toBe("case/77/try/5/new_ui")
  })
})
