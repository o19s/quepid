import { buildControllerFixture } from "../support/controller_fixture"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { apiFetch } from "api/fetch"
import BulkJudgementController from "controllers/bulk_judgement_controller"

vi.mock("api/fetch", () => ({ apiFetch: vi.fn() }))

const QDP = "7"

function mount() {
  const element = document.createElement("div")
  element.innerHTML = `
    <div id="qdp_${QDP}">
      <div class="rating-buttons-container">
        <input type="radio" id="r0" name="judgement_${QDP}" value="0">
        <label for="r0">0</label>
        <input type="radio" id="r1" name="judgement_${QDP}" value="1">
        <label for="r1">1</label>
      </div>
      <div class="rating-buttons"><div class="d-flex"></div></div>
      <textarea id="explanation_${QDP}" data-query-doc-pair-id="${QDP}"></textarea>
      <span id="status_${QDP}"></span>
    </div>`
  document.body.appendChild(element)
  const controller = buildControllerFixture(BulkJudgementController, {
    element,
    values: {
      saveUrl: "books/3/judge/bulk/save",
      deleteUrl: "books/3/judge/bulk/delete"
    }
  })
  controller.connect()
  return { controller, element }
}

const ratingButton = rating => ({ currentTarget: { dataset: { queryDocPairId: QDP, rating } } })
const status = element => element.querySelector(`#status_${QDP}`)
const ok = (ok = true, code = 200) => ({ text: async () => "", json: async () => null,  ok, status: code })

describe("BulkJudgementController", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    document.body.innerHTML = ""
  })

  describe("saveRating", () => {
    it("selects the rating optimistically, adds a reset button, and posts the judgement", async () => {
      apiFetch.mockResolvedValue(ok())
      const { controller, element } = mount()
      element.querySelector(`#explanation_${QDP}`).value = "because"

      const pending = controller.saveRating(ratingButton("1"))

      expect(element.querySelector("#r1").checked).toBe(true)
      expect(element.querySelector('label[for="r1"]').classList.contains("btn-preselected")).toBe(true)
      expect(element.querySelector('button[data-action*="resetRating"]')).not.toBeNull()
      expect(status(element).textContent).toMatch(/Saving/)

      await pending

      expect(apiFetch).toHaveBeenCalledWith("books/3/judge/bulk/save", expect.objectContaining({ method: "POST" }))
      expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toEqual({
        query_doc_pair_id: QDP,
        rating: "1",
        explanation: "because"
      })
      expect(status(element).textContent).toMatch(/Saved/)
    })

    it("moves the highlight when a different rating is chosen and does not duplicate the reset button", async () => {
      apiFetch.mockResolvedValue(ok())
      const { controller, element } = mount()

      await controller.saveRating(ratingButton("0"))
      await controller.saveRating(ratingButton("1"))

      expect(element.querySelector('label[for="r0"]').classList.contains("btn-preselected")).toBe(false)
      expect(element.querySelector('label[for="r1"]').classList.contains("btn-preselected")).toBe(true)
      expect(element.querySelectorAll('button[data-action*="resetRating"]')).toHaveLength(1)
    })

    it("shows an error when the server rejects the save", async () => {
      apiFetch.mockResolvedValue(ok(false, 500))
      const { controller, element } = mount()

      await controller.saveRating(ratingButton("1"))

      expect(status(element).textContent).toMatch(/Error saving/)
      expect(status(element).classList.contains("text-danger")).toBe(true)
    })

    it("shows an error when the request throws", async () => {
      apiFetch.mockRejectedValue(new Error("offline"))
      const { controller, element } = mount()

      await controller.saveRating(ratingButton("1"))

      expect(status(element).textContent).toMatch(/Error saving/)
    })

    it("clears the 'Saved' message after two seconds", async () => {
      vi.useFakeTimers()
      apiFetch.mockResolvedValue(ok())
      const { controller, element } = mount()

      await controller.saveRating(ratingButton("1"))
      expect(status(element).textContent).toMatch(/Saved/)

      vi.advanceTimersByTime(2000)
      expect(status(element).textContent).toBe("")
    })
  })

  describe("resetRating", () => {
    async function mountWithRating() {
      apiFetch.mockResolvedValue(ok())
      const setup = mount()
      await setup.controller.saveRating(ratingButton("1"))
      setup.element.querySelector(`#explanation_${QDP}`).value = "why"
      apiFetch.mockClear()
      const button = setup.element.querySelector('button[data-action*="resetRating"]')
      return { ...setup, button }
    }

    it("deletes the judgement, clears the UI, and removes the reset button", async () => {
      const { controller, element, button } = await mountWithRating()
      apiFetch.mockResolvedValue(ok())

      await controller.resetRating({ currentTarget: button })

      expect(apiFetch).toHaveBeenCalledWith("books/3/judge/bulk/delete", expect.objectContaining({ method: "DELETE" }))
      expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toEqual({ query_doc_pair_id: QDP })
      expect(element.querySelector("#r1").checked).toBe(false)
      expect(element.querySelector('label[for="r1"]').classList.contains("btn-preselected")).toBe(false)
      expect(element.querySelector(`#explanation_${QDP}`).value).toBe("")
      expect(element.contains(button)).toBe(false)
      expect(status(element).textContent).toMatch(/Reset/)
    })

    it("treats 404 (nothing to delete) as a successful reset", async () => {
      const { controller, element, button } = await mountWithRating()
      apiFetch.mockResolvedValue(ok(false, 404))

      await controller.resetRating({ currentTarget: button })

      expect(element.querySelector("#r1").checked).toBe(false)
      expect(status(element).textContent).toMatch(/Reset/)
    })

    it("keeps the rating and reports an error on other failures", async () => {
      const { controller, element, button } = await mountWithRating()
      apiFetch.mockResolvedValue(ok(false, 500))

      await controller.resetRating({ currentTarget: button })

      expect(element.querySelector("#r1").checked).toBe(true)
      expect(element.contains(button)).toBe(true)
      expect(status(element).textContent).toMatch(/Error saving/)
    })

    it("reports an error when the request throws", async () => {
      const { controller, element, button } = await mountWithRating()
      apiFetch.mockRejectedValue(new Error("offline"))

      await controller.resetRating({ currentTarget: button })

      expect(element.querySelector("#r1").checked).toBe(true)
      expect(status(element).textContent).toMatch(/Error saving/)
    })
  })

  describe("saveExplanation (debounced)", () => {
    const field = element => {
      const el = element.querySelector(`#explanation_${QDP}`)
      return { currentTarget: el }
    }

    it("shows 'Typing...' immediately and saves once after a second of quiet", async () => {
      vi.useFakeTimers()
      apiFetch.mockResolvedValue(ok())
      const { controller, element } = mount()
      const event = field(element)

      event.currentTarget.value = "a"
      controller.saveExplanation(event)
      event.currentTarget.value = "ab"
      controller.saveExplanation(event)
      expect(status(element).textContent).toMatch(/Typing/)
      expect(apiFetch).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1000)

      expect(apiFetch).toHaveBeenCalledTimes(1)
      expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toEqual({
        query_doc_pair_id: QDP,
        rating: null,
        explanation: "ab"
      })
      expect(status(element).textContent).toMatch(/Saved/)
    })

    it("includes the currently checked rating", async () => {
      vi.useFakeTimers()
      apiFetch.mockResolvedValue(ok())
      const { controller, element } = mount()
      element.querySelector("#r0").checked = true
      const event = field(element)
      event.currentTarget.value = "note"

      controller.saveExplanation(event)
      await vi.advanceTimersByTimeAsync(1000)

      expect(JSON.parse(apiFetch.mock.calls[0][1].body).rating).toBe("0")
    })

    it("does not save, and clears the status, when there is no rating and only whitespace", async () => {
      vi.useFakeTimers()
      const { controller, element } = mount()
      const event = field(element)
      event.currentTarget.value = "   "

      controller.saveExplanation(event)
      await vi.advanceTimersByTimeAsync(1000)

      expect(apiFetch).not.toHaveBeenCalled()
      expect(status(element).textContent).toBe("")
    })

    it("shows an error when the save fails or throws", async () => {
      vi.useFakeTimers()
      const { controller, element } = mount()
      const event = field(element)
      event.currentTarget.value = "note"

      apiFetch.mockResolvedValue(ok(false, 500))
      controller.saveExplanation(event)
      await vi.advanceTimersByTimeAsync(1000)
      expect(status(element).textContent).toMatch(/Error saving/)

      apiFetch.mockRejectedValue(new Error("offline"))
      controller.saveExplanation(event)
      await vi.advanceTimersByTimeAsync(1000)
      expect(status(element).textContent).toMatch(/Error saving/)
    })

    it("cancels a pending save on disconnect", async () => {
      vi.useFakeTimers()
      const { controller, element } = mount()
      const event = field(element)
      event.currentTarget.value = "note"

      controller.saveExplanation(event)
      controller.disconnect()
      await vi.advanceTimersByTimeAsync(2000)

      expect(apiFetch).not.toHaveBeenCalled()
    })
  })

  it("ignores status updates for rows that are not on the page", () => {
    const { controller } = mount()
    expect(() => controller.showStatus("999", "saved")).not.toThrow()
  })
})
