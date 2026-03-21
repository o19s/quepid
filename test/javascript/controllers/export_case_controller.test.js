import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { Application } from "@hotwired/stimulus"
import ExportCaseController from "../../../app/javascript/controllers/export_case_controller"
import { waitForController } from "../support/stimulus_helpers"

describe("ExportCaseController", () => {
  let application
  const originalFetch = global.fetch

  beforeEach(async () => {
    document.head.innerHTML = '<meta name="csrf-token" content="test-csrf">'
    document.body.setAttribute("data-quepid-root-url", "")

    document.body.innerHTML = `
      <div data-controller="export-case"
           data-export-case-case-id-value="42"
           data-export-case-case-name-value="Test Case">

        <a href="#" data-action="click->export-case#open">Export</a>

        <div class="modal fade" tabindex="-1" data-export-case-target="modal">
          <form data-action="submit->export-case#submit">
            <input type="radio" name="exportFormat" value="basic"
                   data-export-case-target="formatRadio"
                   data-action="change->export-case#selectFormat">
            <input type="radio" name="exportFormat" value="trec"
                   data-export-case-target="formatRadio"
                   data-action="change->export-case#selectFormat">
            <input type="radio" name="exportFormat" value="quepid"
                   data-export-case-target="formatRadio"
                   data-action="change->export-case#selectFormat">
            <input type="radio" name="exportFormat" value="rre"
                   data-export-case-target="formatRadio"
                   data-action="change->export-case#selectFormat">
            <input type="radio" name="exportFormat" value="ltr"
                   data-export-case-target="formatRadio"
                   data-action="change->export-case#selectFormat">
            <input type="radio" name="exportFormat" value="information_need"
                   data-export-case-target="formatRadio"
                   data-action="change->export-case#selectFormat">

            <div class="d-none" data-export-case-target="snapshotGroup">
              <select data-export-case-target="snapshotSelect">
                <option value="">None</option>
                <option value="5">Snapshot A</option>
              </select>
            </div>

            <button type="submit" data-export-case-target="submitButton" disabled>Export</button>
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

    // Stub URL.createObjectURL and URL.revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => "blob:test")
    global.URL.revokeObjectURL = vi.fn()

    application = Application.start()
    application.register("export-case", ExportCaseController)
    await waitForController(application, '[data-controller="export-case"]', "export-case")
  })

  afterEach(() => {
    if (application) application.stop()
    delete window.bootstrap
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it("enables submit button when format is selected", () => {
    const el = document.querySelector('[data-controller="export-case"]')
    const ctrl = application.getControllerForElementAndIdentifier(el, "export-case")

    expect(ctrl.submitButtonTarget.disabled).toBe(true)

    const basicRadio = document.querySelector('[value="basic"]')
    basicRadio.checked = true
    ctrl.selectFormat({ currentTarget: basicRadio })

    expect(ctrl.submitButtonTarget.disabled).toBe(false)
  })

  it("shows snapshot group for basic format", () => {
    const el = document.querySelector('[data-controller="export-case"]')
    const ctrl = application.getControllerForElementAndIdentifier(el, "export-case")

    const basicRadio = document.querySelector('[value="basic"]')
    ctrl.selectFormat({ currentTarget: basicRadio })

    expect(ctrl.snapshotGroupTarget.classList.contains("d-none")).toBe(false)
  })

  it("hides snapshot group for non-snapshot formats", () => {
    const el = document.querySelector('[data-controller="export-case"]')
    const ctrl = application.getControllerForElementAndIdentifier(el, "export-case")

    const quepidRadio = document.querySelector('[value="quepid"]')
    ctrl.selectFormat({ currentTarget: quepidRadio })

    expect(ctrl.snapshotGroupTarget.classList.contains("d-none")).toBe(true)
  })

  it("fetches basic CSV export", async () => {
    const el = document.querySelector('[data-controller="export-case"]')
    const ctrl = application.getControllerForElementAndIdentifier(el, "export-case")

    const basicRadio = document.querySelector('[value="basic"]')
    ctrl.selectFormat({ currentTarget: basicRadio })

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob(["q,d,r"], { type: "text/csv" })),
      }),
    )

    // Stub click on created <a> element
    const clickSpy = vi.fn()
    vi.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "a") {
        const a = { click: clickSpy, href: "", download: "" }
        // Mock appendChild/removeChild
        document.body.appendChild = vi.fn()
        document.body.removeChild = vi.fn()
        return a
      }
      return document.createElement(tag)
    })

    await ctrl.submit(new Event("submit", { cancelable: true }))

    expect(global.fetch).toHaveBeenCalledOnce()
    const [url] = global.fetch.mock.calls[0]
    expect(url).toBe("api/export/ratings/42.csv?file_format=basic")
  })

  it("fetches quepid JSON export with correct URL", async () => {
    const el = document.querySelector('[data-controller="export-case"]')
    const ctrl = application.getControllerForElementAndIdentifier(el, "export-case")

    const quepidRadio = document.querySelector('[value="quepid"]')
    ctrl.selectFormat({ currentTarget: quepidRadio })

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob(["{}"], { type: "application/json" })),
      }),
    )

    vi.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "a") {
        const a = { click: vi.fn(), href: "", download: "" }
        document.body.appendChild = vi.fn()
        document.body.removeChild = vi.fn()
        return a
      }
      return document.createElement(tag)
    })

    await ctrl.submit(new Event("submit", { cancelable: true }))

    const [url] = global.fetch.mock.calls[0]
    expect(url).toBe("api/export/cases/42.json")
  })

  it("includes snapshot_id for basic format when selected", async () => {
    const el = document.querySelector('[data-controller="export-case"]')
    const ctrl = application.getControllerForElementAndIdentifier(el, "export-case")

    const basicRadio = document.querySelector('[value="basic"]')
    ctrl.selectFormat({ currentTarget: basicRadio })
    ctrl.snapshotSelectTarget.value = "5"

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob(["q,d,r"])),
      }),
    )

    vi.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "a") {
        const a = { click: vi.fn(), href: "", download: "" }
        document.body.appendChild = vi.fn()
        document.body.removeChild = vi.fn()
        return a
      }
      return document.createElement(tag)
    })

    await ctrl.submit(new Event("submit", { cancelable: true }))

    const [url] = global.fetch.mock.calls[0]
    expect(url).toBe("api/export/ratings/42.csv?file_format=basic_snapshot&snapshot_id=5")
  })
})
