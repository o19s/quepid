import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import CaseToolbarController from "controllers/case_toolbar_controller"

/**
 * This controller exists only to bridge the server-rendered case header to the Angular services
 * that still run the case page, in both directions. It deliberately does not copy the case name
 * onto the toolbar's modal triggers — those read it live via `utils/case_header` — so there is no
 * attribute synchronisation to cover here.
 */
function buildToolbar() {
  const element = document.createElement("div")
  document.body.appendChild(element)

  const controller = Object.create(CaseToolbarController.prototype)
  controller.element = element
  return controller
}

function buildFrame({
  id = "case_header",
  caseNo = "7",
  caseName = "New Name",
  tryNo = "4",
  tryName = "Try 4"
} = {}) {
  const frame = document.createElement("turbo-frame")
  frame.id = id

  const meta = document.createElement("div")
  if (caseNo !== null) meta.setAttribute("data-case-header-case-no", caseNo)
  if (caseName !== null) meta.setAttribute("data-case-header-case-name", caseName)
  if (tryNo !== null) meta.setAttribute("data-case-header-try-no", tryNo)
  if (tryName !== null) meta.setAttribute("data-case-header-try-name", tryName)

  const display = document.createElement("span")
  display.setAttribute("data-case-rename-target", "caseDisplay")
  display.textContent = caseName ?? ""
  meta.appendChild(display)

  frame.appendChild(meta)
  document.body.appendChild(frame)
  return frame
}

function renderFrame(controller, frame) {
  CaseToolbarController.prototype.handleFrameRender.call(controller, { target: frame })
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
    vi.restoreAllMocks()
  })

  describe("header frame re-rendered by Rails", () => {
    it("bridges the rename to caseSvc and settingsSvc", () => {
      renderFrame(controller, buildFrame())

      const caseEvent = dispatched.find((e) => e.type === "case-header:renamed")
      const tryEvent = dispatched.find((e) => e.type === "case-header:try-renamed")

      expect(caseEvent.detail).toEqual({ caseNo: 7, caseName: "New Name" })
      expect(tryEvent.detail).toEqual({ tryNo: 4, name: "Try 4" })
    })

    it("ignores frames other than the case header", () => {
      renderFrame(controller, buildFrame({ id: "some_other_frame" }))

      expect(dispatched).toHaveLength(0)
    })

    it("does not dispatch a try rename when the header has no try", () => {
      renderFrame(controller, buildFrame({ tryNo: null, tryName: null }))

      expect(dispatched.map((e) => e.type)).toEqual(["case-header:renamed"])
    })

    it("survives a frame render with no header metadata", () => {
      const frame = document.createElement("turbo-frame")
      frame.id = "case_header"
      document.body.appendChild(frame)

      expect(() => renderFrame(controller, frame)).not.toThrow()
      expect(dispatched).toHaveLength(0)
    })
  })

  /**
   * The wizard renames the case through Angular's caseSvc, and the header is server-rendered, so
   * nothing would update it. The name is patched synchronously rather than waiting on the frame
   * refetch: under load that round trip loses the race with whatever reads the header next, which
   * is exactly how the wizard E2E spec failed.
   */
  describe("rename originating in Angular", () => {
    it("patches the rendered heading without waiting for the refetch", () => {
      const frame = buildFrame({ caseName: "Old Name" })
      controller.headerUrlValue = "/case/7/header"
      controller.hasHeaderUrlValue = true

      CaseToolbarController.prototype.handleAngularRename.call(controller, {
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

      CaseToolbarController.prototype.handleAngularRename.call(controller, {
        detail: { caseNo: 7, caseName: "Wizard Name" }
      })

      expect(frame.src).toBe("/case/7/header/try/2")
    })

    it("still patches the heading when no refetch url was rendered", () => {
      const frame = buildFrame({ caseName: "Old Name" })
      controller.hasHeaderUrlValue = false

      expect(() =>
        CaseToolbarController.prototype.handleAngularRename.call(controller, {
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
   * Nothing else would: the modal saves over the API and bridges to Angular for the rescore, which
   * was enough only while the header was an Angular template reading the same model.
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

    expect(remove).toHaveBeenCalledWith("turbo:frame-render", controller.onFrameRender)
    expect(remove).toHaveBeenCalledWith("quepid:case-renamed", controller.onAngularRename)
    expect(remove).toHaveBeenCalledWith("pick-scorer:selected", controller.onScorerSelected)
  })
})
