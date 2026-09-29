import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import CaseToolbarController from "controllers/case_toolbar_controller"

/**
 * This controller bridges the server-rendered case header to the framework-free case runtime.
 * It deliberately does not copy the case name onto the toolbar's modal triggers — those read it
 * live via `utils/case_header`.
 */
function buildToolbar() {
  const element = document.createElement("div")
  document.body.appendChild(element)

  const controller = Object.create(CaseToolbarController.prototype)
  controller.element = element
  return controller
}

function buildFrame({ caseName = "New Name" } = {}) {
  const frame = document.createElement("turbo-frame")
  frame.id = "case_header"

  const meta = document.createElement("div")
  meta.setAttribute("data-case-header-case-no", "7")
  meta.setAttribute("data-case-header-case-name", caseName)

  const display = document.createElement("span")
  display.setAttribute("data-case-rename-target", "caseDisplay")
  display.textContent = caseName
  meta.appendChild(display)
  frame.appendChild(meta)
  document.body.appendChild(frame)
  return frame
}

describe("CaseToolbarController", () => {
  let controller
  let dispatched

  beforeEach(() => {
    document.body.innerHTML = ""
    controller = buildToolbar()
    dispatched = []
    vi.spyOn(document, "dispatchEvent").mockImplementation((event) => {
      dispatched.push(event)
      return true
    })
  })

  afterEach(() => {
    delete window.jQuery
    delete window.$
    vi.restoreAllMocks()
  })

  it("toggles the Tune Relevance pane through the legacy pane event", () => {
    const preventDefault = vi.fn()

    CaseToolbarController.prototype.toggleTuneRelevance.call(controller, { preventDefault })

    expect(preventDefault).toHaveBeenCalled()
    expect(dispatched[0].type).toBe("toggleEast")
  })

  /**
   * The wizard renames the case through the case runtime, and the header is server-rendered, so
   * nothing would update it. The name is patched synchronously rather than waiting on the frame
   * refetch: under load that round trip loses the race with whatever reads the header next, which
   * is exactly how the wizard E2E spec failed.
   */
  describe("rename originating in the case runtime", () => {
    it("patches the rendered heading without waiting for the refetch", () => {
      const frame = buildFrame({ caseName: "Old Name" })
      controller.headerUrlValue = "/case/7/header"
      controller.hasHeaderUrlValue = true

      CaseToolbarController.prototype.handleCaseRenamed.call(controller, {
        detail: { caseNo: 7, caseName: "Wizard Name" }
      })

      const meta = frame.querySelector("[data-case-header-case-no]")
      expect(meta.querySelector('[data-case-rename-target="caseDisplay"]').textContent)
        .toBe("Wizard Name")
      expect(meta.dataset.caseHeaderCaseName).toBe("Wizard Name")
    })

    it("also asks the header frame to refetch so the rest of it catches up", () => {
      const frame = buildFrame()
      controller.headerUrlValue = "/case/7/header/try/2"
      controller.hasHeaderUrlValue = true

      CaseToolbarController.prototype.handleCaseRenamed.call(controller, {
        detail: { caseNo: 7, caseName: "Wizard Name" }
      })

      expect(frame.src).toBe("/case/7/header/try/2")
    })

    it("still patches the heading when no refetch url was rendered", () => {
      const frame = buildFrame({ caseName: "Old Name" })
      controller.hasHeaderUrlValue = false

      expect(() =>
        CaseToolbarController.prototype.handleCaseRenamed.call(controller, {
          detail: { caseNo: 7, caseName: "Wizard Name" }
        })
      ).not.toThrow()

      expect(
        frame.querySelector('[data-case-rename-target="caseDisplay"]').textContent
      ).toBe("Wizard Name")
    })
  })

  /**
   * The header renders the scorer name server-side, so picking a scorer has to refetch the frame.
   * Nothing else would: the modal saves over the API and bridges to the live
   * scoring runtime for the rescore.
   */
  describe("scorer chosen in the pick-scorer modal", () => {
    it("refetches the header frame so the new scorer name renders", () => {
      const frame = buildFrame()
      controller.headerUrlValue = "/case/7/header/try/2"
      controller.hasHeaderUrlValue = true

      CaseToolbarController.prototype.handleScorerSelected.call(controller)

      expect(frame.src).toBe("/case/7/header/try/2")
    })

    it("does nothing when no refetch url was rendered", () => {
      buildFrame()
      controller.hasHeaderUrlValue = false

      expect(() =>
        CaseToolbarController.prototype.handleScorerSelected.call(controller)
      ).not.toThrow()
    })
  })

  /**
   * Anything the server-rendered header shows goes stale unless something refetches the frame,
   * so surfaces that mutate that state dispatch `quepid:case-header-stale` (see the contract in
   * core/_case_header.html.erb). These go through connect() and a real dispatched event rather
   * than calling the handler directly: the bug this guards against is the event never arriving,
   * which a direct call cannot catch.
   */
  describe("generic header-stale signal", () => {
    afterEach(() => {
      CaseToolbarController.prototype.disconnect.call(controller)
    })

    it("refetches the header when the event is dispatched on document", () => {
      const frame = buildFrame()
      controller.headerUrlValue = "/case/7/header/try/2"
      controller.hasHeaderUrlValue = true
      vi.restoreAllMocks() // let the real dispatchEvent through

      CaseToolbarController.prototype.connect.call(controller)
      document.dispatchEvent(new CustomEvent("quepid:case-header-stale", {
        detail: { caseNo: 7, reason: "nightly" }
      }))

      expect(frame.src).toBe("/case/7/header/try/2")
    })

    it("stops refetching once disconnected", () => {
      const frame = buildFrame()
      controller.headerUrlValue = "/case/7/header/try/2"
      controller.hasHeaderUrlValue = true
      vi.restoreAllMocks()

      CaseToolbarController.prototype.connect.call(controller)
      CaseToolbarController.prototype.disconnect.call(controller)
      document.dispatchEvent(new CustomEvent("quepid:case-header-stale"))

      // jsdom treats <turbo-frame> as an unknown element, so an untouched src is undefined
      // rather than "" — assert the refetch simply did not happen.
      expect(frame.src).not.toBe("/case/7/header/try/2")
    })
  })

  it("removes its document listeners on disconnect", () => {
    const remove = vi.spyOn(document, "removeEventListener")
    CaseToolbarController.prototype.connect.call(controller)
    CaseToolbarController.prototype.disconnect.call(controller)

    expect(remove).toHaveBeenCalledWith("quepid:case-renamed", controller.onCaseRenamed)
    expect(remove).toHaveBeenCalledWith("pick-scorer:selected", controller.onScorerSelected)
  })
})
