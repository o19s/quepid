import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import UserActivityController from "controllers/user_activity_controller"

function buildController() {
  const controller = Object.create(UserActivityController.prototype)
  controller.element = document.createElement("div")
  controller.urlValue = "/admin/users/1/pulse?data=scores"
  controller.labelValue = "Scores"
  return controller
}

describe("UserActivityController", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  describe("formatDate", () => {
    it("zero-pads month and day", () => {
      expect(buildController().formatDate(new Date(2026, 0, 5))).toBe("2026-01-05")
      expect(buildController().formatDate(new Date(2026, 11, 25))).toBe("2026-12-25")
    })
  })

  describe("fillDateRange", () => {
    it("emits one row per day, exclusive of the end date, zero-filling gaps", () => {
      const controller = buildController()
      const rows = controller.fillDateRange(new Date(2026, 2, 1), new Date(2026, 2, 4), [
        { date: "2026-03-02", value: 5 }
      ])

      expect(rows.map(r => [r.date, r.value])).toEqual([
        ["2026-03-01", 0],
        ["2026-03-02", 5],
        ["2026-03-03", 0]
      ])
      expect(rows[1].tooltipDate).toBe("Mar 2, 2026")
    })

    it("ignores activity outside the range", () => {
      const rows = buildController().fillDateRange(new Date(2026, 2, 1), new Date(2026, 2, 3), [
        { date: "2025-01-01", value: 9 }
      ])
      expect(rows.every(r => r.value === 0)).toBe(true)
    })
  })

  describe("buildSpec", () => {
    it("floors the colour domain at 1 when there is no activity", () => {
      const spec = buildController().buildSpec([{ date: "2026-03-01", value: 0 }])
      expect(spec.encoding.color.scale.domain).toEqual([0, 1])
    })

    it("uses the largest daily value as the top of the colour domain", () => {
      const spec = buildController().buildSpec([
        { date: "2026-03-01", value: 3 },
        { date: "2026-03-02", value: 12 }
      ])
      expect(spec.encoding.color.scale.domain).toEqual([0, 12])
    })

    it("labels the tooltip with the configured label", () => {
      const spec = buildController().buildSpec([])
      expect(spec.encoding.tooltip.value.signal).toContain('"Scores"')
    })
  })

  describe("fetchData", () => {
    it("requests the URL with a start/end range and converts unix seconds to dates", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        async text() {
          return JSON.stringify(await this.json()) || ""
        },
        ok: true,
        json: async () => ({ [String(Date.UTC(2026, 2, 2, 12) / 1000)]: 4 })
      })
      vi.stubGlobal("fetch", fetchMock)

      const data = await buildController().fetchData(new Date(2026, 0, 1), new Date(2026, 0, 31))

      expect(fetchMock).toHaveBeenCalledWith(`${window.location.origin}/admin/users/1/pulse?data=scores&start=2026-01-01&end=2026-01-31`, {
        method: "GET",
        headers: { Accept: "application/json", "X-CSRF-Token": "" }
      })
      expect(data).toEqual([{ date: "2026-03-02", value: 4 }])
    })

    it("adds the range to a URL without a query string", () => {
      const controller = buildController()
      controller.urlValue = "/admin/users/1/pulse"

      expect(controller.activityUrl(new Date(2026, 0, 1), new Date(2026, 0, 31))).toBe(
        `${window.location.origin}/admin/users/1/pulse?start=2026-01-01&end=2026-01-31`
      )
    })

    it("returns an empty list for a successful response with no activity", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => "{}" }))
      expect(await buildController().fetchData(new Date(), new Date())).toEqual([])
    })

    it("returns null when the server responds with an error status", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ text: async () => "", json: async () => null,  ok: false, status: 500 }))
      expect(await buildController().fetchData(new Date(), new Date())).toBe(null)
    })

    it("returns null when the request fails", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
      expect(await buildController().fetchData(new Date(), new Date())).toBe(null)
    })
  })

  describe("initializeHeatmap", () => {
    it("finalizes the Vega view on disconnect", async () => {
      const view = { finalize: vi.fn() }
      vi.stubGlobal("vegaEmbed", vi.fn().mockResolvedValue({ view }))
      const controller = buildController()
      controller.fetchData = vi.fn().mockResolvedValue([])
      await controller.initializeHeatmap()
      controller.disconnect()
      controller.disconnect()
      expect(view.finalize).toHaveBeenCalledOnce()
    })

    it("does not render a fetch that finishes after disconnect", async () => {
      let finish
      const controller = buildController()
      controller.fetchData = () => new Promise(resolve => { finish = resolve })
      const embed = vi.fn()
      vi.stubGlobal("vegaEmbed", embed)
      const pending = controller.initializeHeatmap()
      controller.disconnect()
      finish(null)
      await pending
      expect(embed).not.toHaveBeenCalled()
      expect(controller.element.textContent).toBe("")
    })

    it("finalizes a late Vega result without replacing the reconnected view", async () => {
      let finish
      const oldView = { finalize: vi.fn() }
      const newView = { finalize: vi.fn() }
      const embed = vi.fn()
        .mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
        .mockResolvedValueOnce({ view: newView })
      vi.stubGlobal("vegaEmbed", embed)
      const controller = buildController()
      controller.fetchData = vi.fn().mockResolvedValue([])
      const pending = controller.initializeHeatmap()
      await Promise.resolve()
      controller.disconnect()
      await controller.initializeHeatmap()
      finish({ view: oldView })
      await pending
      expect(oldView.finalize).toHaveBeenCalledOnce()
      expect(newView.finalize).not.toHaveBeenCalled()
      expect(controller.view).toBe(newView)
    })

    it("renders the heatmap with vegaEmbed into the element", async () => {
      const vegaEmbed = vi.fn().mockResolvedValue({})
      vi.stubGlobal("vegaEmbed", vegaEmbed)
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ text: async function () { return JSON.stringify(await this.json()) || "" },  ok: true, json: async () => ({}) }))
      const controller = buildController()

      await controller.initializeHeatmap()

      expect(vegaEmbed).toHaveBeenCalledTimes(1)
      const [target, spec, options] = vegaEmbed.mock.calls[0]
      expect(target).toBe(controller.element)
      expect(spec.data.values.length).toBeGreaterThan(300)
      expect(options).toMatchObject({ actions: false, renderer: "svg" })
    })

    it("shows a load error instead of an empty calendar when the fetch fails", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
      const vegaEmbed = vi.fn()
      vi.stubGlobal("vegaEmbed", vegaEmbed)
      const controller = buildController()

      await controller.initializeHeatmap()

      expect(vegaEmbed).not.toHaveBeenCalled()
      expect(controller.element.textContent).toBe("Could not load activity data.")
    })

    it("logs render errors without throwing", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => "{}" }))
      vi.stubGlobal("vegaEmbed", vi.fn().mockRejectedValue(new Error("vega broke")))
      const controller = buildController()

      await expect(controller.initializeHeatmap()).resolves.toBeUndefined()
      expect(console.error).toHaveBeenCalledWith("Error rendering activity heatmap:", expect.any(Error))
    })
  })
})
