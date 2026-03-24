import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { Application } from "@hotwired/stimulus"
import MoveQueryModalController from "../../../app/javascript/controllers/move_query_modal_controller"
import { waitForController } from "../support/stimulus_helpers"

describe("MoveQueryModalController", () => {
  let application

  beforeEach(async () => {
    document.head.innerHTML = '<meta name="csrf-token" content="test-csrf">'
    document.body.setAttribute("data-case-id", "7")
    document.body.innerHTML = `
      <div id="query-list-shell">
        <li data-query-id="55" id="moved-row">query</li>
      </div>
      <div id="move-query-modal" data-controller="move-query-modal" class="modal fade">
        <p data-move-query-modal-target="loading">Loading</p>
        <p class="d-none" data-move-query-modal-target="empty">empty</p>
        <div class="d-none" data-move-query-modal-target="caseBlock">
          <div class="list-group" data-move-query-modal-target="caseList"></div>
        </div>
        <button type="button" disabled data-move-query-modal-target="confirmBtn"
                data-action="click->move-query-modal#confirmMove">
          Move to <span data-move-query-modal-target="confirmLabel"></span>
        </button>
      </div>
    `

    window.bootstrap = {
      Modal: {
        getOrCreateInstance: vi.fn(() => ({ show: vi.fn() })),
        getInstance: vi.fn(() => ({ hide: vi.fn() })),
      },
    }

    application = Application.start()
    application.register("move-query-modal", MoveQueryModalController)
    await waitForController(application, "#move-query-modal", "move-query-modal")
  })

  afterEach(() => {
    application.stop()
    delete window.bootstrap
    vi.restoreAllMocks()
  })

  function getController() {
    return application.getControllerForElementAndIdentifier(
      document.getElementById("move-query-modal"),
      "move-query-modal",
    )
  }

  it("open lists other cases and enables confirm after selection", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          all_cases: [
            { case_id: 7, case_name: "Current" },
            { case_id: 8, case_name: "Other case" },
          ],
        }),
    })

    try {
      const ctrl = getController()
      await ctrl.open({ queryId: 55 })

      expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining("api/cases"), expect.anything())
      expect(ctrl.caseListTarget.querySelectorAll(".list-group-item")).toHaveLength(1)
      expect(ctrl.caseListTarget.textContent).toContain("Other case")

      const item = ctrl.caseListTarget.querySelector(".list-group-item")
      item.click()

      expect(ctrl.confirmBtnTarget.disabled).toBe(false)
      expect(ctrl.confirmLabelTarget.textContent).toBe("Other case")
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it("confirmMove PUTs other_case_id, dispatches query-moved-away, removes row", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url, init) => {
      const u = String(url)
      if (u.includes("api/cases") && !init?.method) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              all_cases: [{ case_id: 8, case_name: "Target" }],
            }),
        })
      }
      if (init?.method === "PUT" && u.includes("queries/55")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      }
      return Promise.reject(new Error(`unexpected ${u}`))
    })

    const moved = vi.fn()
    document.addEventListener("query-moved-away", moved)

    try {
      const ctrl = getController()
      await ctrl.open({ queryId: 55 })
      ctrl.caseListTarget.querySelector(".list-group-item").click()
      await ctrl.confirmMove()

      const putCall = fetchSpy.mock.calls.find((c) => c[1]?.method === "PUT")
      expect(putCall).toBeDefined()
      expect(JSON.parse(putCall[1].body).other_case_id).toBe(8)
      expect(moved).toHaveBeenCalled()
      expect(moved.mock.calls[0][0].detail.queryId).toBe(55)
      expect(document.getElementById("moved-row")).toBeNull()
    } finally {
      document.removeEventListener("query-moved-away", moved)
      fetchSpy.mockRestore()
    }
  })
})
