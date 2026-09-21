import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { apiFetch } from "api/fetch"
import { downloadBlob } from "utils/download_file"
import ExportCaseCoreController from "controllers/export_case_core_controller"
import { mountCaseHeader } from "../support/case_header_dom"

vi.mock("api/fetch", () => ({
  apiFetch: vi.fn()
}))

vi.mock("utils/download_file", () => ({
  downloadBlob: vi.fn()
}))

function buildModalController(overrides = {}) {
  const controller = Object.create(ExportCaseCoreController.prototype)
  controller.application = {
    getControllerForElementAndIdentifier: vi.fn(() => null)
  }
  controller.element = document.createElement("div")
  controller.element.innerHTML = `
    <input type="radio" name="export-case-format" value="information_need">
    <input type="radio" name="export-case-format" value="general">
    <input type="radio" name="export-case-format" value="detailed">
    <input type="radio" name="export-case-format" value="snapshot">
    <input type="radio" name="export-case-format" value="basic">
    <input type="radio" name="export-case-format" value="trec">
  `

  controller.snapshotsIndexUrlTemplateValue = "/api/cases/__CASE_ID__/snapshots"
  controller.hasSnapshotsIndexUrlTemplateValue = true
  controller.snapshotShowUrlTemplateValue = "/api/cases/__CASE_ID__/snapshots/__SNAPSHOT_ID__"
  controller.caseUrlTemplateValue = "/api/cases/__CASE_ID__"
  controller.queriesUrlTemplateValue = "/api/cases/__CASE_ID__/queries"
  controller.annotationsUrlTemplateValue = "/api/cases/__CASE_ID__/annotations"
  controller.scoresUrlTemplateValue = "/api/cases/__CASE_ID__/scores"
  controller.ratingsExportUrlTemplateValue = "/api/export/ratings/__CASE_ID__.__FORMAT__"
  controller.informationNeedUrlTemplateValue = "/api/export/queries/information_needs/__CASE_ID__.csv"
  controller.quepidExportUrlTemplateValue = "/api/export/cases/__CASE_ID__"

  controller.hasTitleTarget = true
  controller.titleTarget = document.createElement("h5")
  controller.hasSubmitButtonTarget = true
  controller.submitButtonTarget = document.createElement("button")
  controller.hasDetailedRadioTarget = true
  controller.detailedRadioTarget = document.createElement("input")
  controller.hasDetailedWarningTarget = true
  controller.detailedWarningTarget = document.createElement("p")
  controller.hasSnapshotRadioTarget = true
  controller.snapshotRadioTarget = document.createElement("input")
  controller.hasSnapshotSelectTarget = true
  controller.snapshotSelectTarget = document.createElement("select")
  controller.hasBasicRadioTarget = true
  controller.basicRadioTarget = document.createElement("input")
  controller.hasBasicSnapshotSelectTarget = true
  controller.basicSnapshotSelectTarget = document.createElement("select")
  controller.hasApiSnapshotSelectTarget = true
  controller.apiSnapshotSelectTarget = document.createElement("select")
  controller.hasApiSnapshotLinkTarget = true
  controller.apiSnapshotLinkTarget = document.createElement("a")
  controller.hasApiSnapshotWrapperTarget = true
  controller.apiSnapshotWrapperTarget = document.createElement("span")
  controller.hasCaseLinkTarget = true
  controller.caseLinkTarget = document.createElement("a")
  controller.hasQueriesLinkTarget = true
  controller.queriesLinkTarget = document.createElement("a")
  controller.hasAnnotationsLinkTarget = true
  controller.annotationsLinkTarget = document.createElement("a")
  controller.hasScoresLinkTarget = true
  controller.scoresLinkTarget = document.createElement("a")
  controller.hasRatingsLinkTarget = true
  controller.ratingsLinkTarget = document.createElement("a")
  controller.hasQuepidPeekLinkTarget = true
  controller.quepidPeekLinkTarget = document.createElement("a")

  Object.assign(controller, overrides)
  return controller
}

function buildTrigger({ id = "5", name = "Movies", supportsDetailedExport = "true" } = {}) {
  mountCaseHeader(name)
  const trigger = document.createElement("a")
  trigger.dataset.exportCaseCoreIdValue = id
  trigger.dataset.exportCaseCoreSupportsDetailedExportValue = supportsDetailedExport
  return trigger
}

function okJsonResponse(body) {
  return { ok: true, json: () => Promise.resolve(body), blob: () => Promise.resolve(new Blob([ "x" ])) }
}

describe("ExportCaseCoreController", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("is not a modal root without a title target", () => {
    const trigger = Object.create(ExportCaseCoreController.prototype)
    trigger.hasTitleTarget = false

    expect(trigger.isModalRoot).toBe(false)
  })

  it("open resets state from the trigger's dataset, disables submit, and loads snapshots", async () => {
    apiFetch.mockResolvedValue(okJsonResponse({ snapshots: [] }))
    const controller = buildModalController()
    const trigger = buildTrigger()

    await controller.open({ preventDefault: () => {}, currentTarget: trigger })

    expect(controller.currentCaseId).toBe("5")
    expect(controller.titleTarget.textContent).toBe("Export Case: Movies")
    expect(controller.submitButtonTarget.disabled).toBe(true)
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/cases/5/snapshots",
      expect.objectContaining({ headers: { Accept: "application/json" } })
    )
    expect(controller.ratingsLinkTarget.getAttribute("href")).toBe("/api/export/ratings/5.json")
  })

  it("disables the detailed radio when the trigger says detailed export isn't supported", async () => {
    apiFetch.mockResolvedValue(okJsonResponse({ snapshots: [] }))
    const controller = buildModalController()
    const trigger = buildTrigger({ supportsDetailedExport: "false" })

    await controller.open({ preventDefault: () => {}, currentTarget: trigger })

    expect(controller.detailedRadioTarget.disabled).toBe(true)
    expect(controller.supportsDetailedExport).toBe(false)
  })

  it("_loadSnapshots populates every snapshot select with a date-prefixed label", async () => {
    apiFetch.mockResolvedValue(okJsonResponse({
      snapshots: [
        { id: 1, name: "Weekly", time: "2026-03-05T12:00:00Z" },
        { id: 2, name: "Monthly", time: "2026-01-01T12:00:00Z" }
      ]
    }))
    const controller = buildModalController()
    controller.currentCaseId = "5"

    await controller._loadSnapshots()

    expect(controller.snapshotSelectTarget.children).toHaveLength(3) // blank + 2
    expect(controller.basicSnapshotSelectTarget.children).toHaveLength(3)
    expect(controller.apiSnapshotSelectTarget.children).toHaveLength(3)
    // Two snapshots can share a name — the date prefix is the only way to tell them apart.
    expect(controller.snapshotSelectTarget.children[1].textContent).toBe("(3/5/26) Weekly")
    expect(controller.snapshotSelectTarget.children[2].textContent).toBe("(1/1/26) Monthly")
  })

  it("selectFormat enables submit and shows the warning only for an unsupported detailed pick", () => {
    const controller = buildModalController()
    controller.supportsDetailedExport = false

    controller.selectFormat({ params: { format: "detailed" } })

    expect(controller.selectedFormat).toBe("detailed")
    expect(controller.submitButtonTarget.disabled).toBe(true)
    expect(controller.detailedWarningTarget.classList.contains("d-none")).toBe(false)
  })

  it("selectSnapshot checks the snapshot radio but keeps submit disabled until a snapshot is actually chosen", () => {
    const controller = buildModalController()

    controller.selectSnapshot()

    expect(controller.snapshotRadioTarget.checked).toBe(true)
    expect(controller.selectedFormat).toBe("snapshot")
    expect(controller.submitButtonTarget.disabled).toBe(true)
  })

  it("selectSnapshot enables submit once a snapshot is chosen from the dropdown", () => {
    const controller = buildModalController()
    controller.snapshotSelectTarget.innerHTML = '<option value="7">(3/5/26) Weekly</option>'
    controller.snapshotSelectTarget.value = "7"

    controller.selectSnapshot()

    expect(controller.submitButtonTarget.disabled).toBe(false)
  })

  it("selectBasicSnapshot always selects Basic, even for a TREC export (mirrors the AngularJS $watch quirk)", () => {
    const controller = buildModalController()

    controller.selectBasicSnapshot()

    expect(controller.basicRadioTarget.checked).toBe(true)
    expect(controller.selectedFormat).toBe("basic")
  })

  describe("submit", () => {
    it("general: fetches case + queries and downloads a CSV built from them", async () => {
      apiFetch.mockImplementation((url) => {
        if (url === "/api/cases/5") {
          return Promise.resolve(okJsonResponse({ case_name: "Movies", case_id: 5, teams: [], last_score: null }))
        }
        return Promise.resolve(okJsonResponse({ queries: [] }))
      })
      const controller = buildModalController()
      controller.currentCaseId = "5"
      controller.currentCaseName = "Movies"
      controller.selectedFormat = "general"

      await controller.submit()

      expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), "Movies_general.csv")
    })

    it("detailed: dispatches a bridge event instead of fetching anything", async () => {
      const dispatchSpy = vi.spyOn(document, "dispatchEvent")
      const controller = buildModalController()
      controller.currentCaseId = "5"
      controller.selectedFormat = "detailed"

      await controller.submit()

      expect(apiFetch).not.toHaveBeenCalled()
      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "export-case:detailed" }))
      expect(dispatchSpy.mock.calls[0][0].detail).toEqual({ caseId: "5" })
    })

    it("basic: exports the plain ratings CSV when no snapshot is chosen", async () => {
      apiFetch.mockResolvedValue(okJsonResponse({}))
      const controller = buildModalController()
      controller.currentCaseId = "5"
      controller.currentCaseName = "Movies"
      controller.selectedFormat = "basic"

      await controller.submit()

      expect(apiFetch).toHaveBeenCalledWith(
        "/api/export/ratings/5.csv?file_format=basic",
        expect.objectContaining({ headers: { Accept: "*/*" } })
      )
      expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), "Movies_basic.csv")
    })

    it("basic: exports the snapshot variant when a snapshot is chosen", async () => {
      apiFetch.mockResolvedValue(okJsonResponse({}))
      const controller = buildModalController()
      controller.currentCaseId = "5"
      controller.currentCaseName = "Movies"
      controller.selectedFormat = "basic"
      controller.basicSnapshotSelectTarget.innerHTML = '<option value="7">Weekly</option>'
      controller.basicSnapshotSelectTarget.value = "7"

      await controller.submit()

      expect(apiFetch).toHaveBeenCalledWith(
        "/api/export/ratings/5.csv?file_format=basic_snapshot&snapshot_id=7",
        expect.anything()
      )
      expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), "Movies_basic_snapshot.csv")
    })

    it("snapshot: does nothing when no snapshot is selected", async () => {
      const controller = buildModalController()
      controller.currentCaseId = "5"
      controller.selectedFormat = "snapshot"

      await controller.submit()

      expect(apiFetch).not.toHaveBeenCalled()
      expect(downloadBlob).not.toHaveBeenCalled()
    })

    it("snapshot: fetches the chosen snapshot and downloads a CSV built from it", async () => {
      apiFetch.mockResolvedValue(okJsonResponse({ name: "Weekly", time: "2026-03-05T12:00:00Z", queries: [], docs: {} }))
      const controller = buildModalController()
      controller.currentCaseId = "5"
      controller.currentCaseName = "Movies"
      controller.selectedFormat = "snapshot"
      controller.snapshotSelectTarget.innerHTML = '<option value="7">Weekly</option>'
      controller.snapshotSelectTarget.value = "7"

      await controller.submit()

      expect(apiFetch).toHaveBeenCalledWith(
        "/api/cases/5/snapshots/7",
        expect.objectContaining({ headers: { Accept: "application/json" } })
      )
      expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), "Movies_snapshot.csv")
    })

    it("does nothing for an unrecognized/unselected format", async () => {
      const controller = buildModalController()
      controller.selectedFormat = null

      await controller.submit()

      expect(apiFetch).not.toHaveBeenCalled()
      expect(downloadBlob).not.toHaveBeenCalled()
    })

    it.each([
      { selectedFormat: "trec", url: "/api/export/ratings/5.txt?file_format=trec", filename: "Movies_trec.txt" },
      {
        selectedFormat: "trec",
        snapshotId: "7",
        url: "/api/export/ratings/5.txt?file_format=trec_snapshot&snapshot_id=7",
        filename: "Movies_trec_snapshot.txt"
      },
      { selectedFormat: "ltr", url: "/api/export/ratings/5.txt?file_format=ltr", filename: "Movies_ltr.txt" },
      {
        selectedFormat: "information_need",
        url: "/api/export/queries/information_needs/5.csv",
        filename: "Movies_information_need.csv"
      }
    ])("$selectedFormat (snapshot=$snapshotId): exports the correct file", async ({ selectedFormat, snapshotId, url, filename }) => {
      apiFetch.mockResolvedValue(okJsonResponse({}))
      const controller = buildModalController()
      controller.currentCaseId = "5"
      controller.currentCaseName = "Movies"
      controller.selectedFormat = selectedFormat
      if (snapshotId) {
        controller.basicSnapshotSelectTarget.innerHTML = `<option value="${snapshotId}">(3/5/26) Weekly</option>`
        controller.basicSnapshotSelectTarget.value = snapshotId
      }

      await controller.submit()

      expect(apiFetch).toHaveBeenCalledWith(url, expect.anything())
      expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), filename)
    })

    it.each([
      { selectedFormat: "rre", url: "/api/export/ratings/5.json?file_format=rre", filename: "Movies_rre.json" },
      { selectedFormat: "quepid", url: "/api/export/cases/5", filename: "Movies_case.json" }
    ])("$selectedFormat: pretty-prints the JSON instead of streaming raw bytes", async ({ selectedFormat, url, filename }) => {
      apiFetch.mockResolvedValue(okJsonResponse({ foo: "bar" }))
      const controller = buildModalController()
      controller.currentCaseId = "5"
      controller.currentCaseName = "Movies"
      controller.selectedFormat = selectedFormat

      await controller.submit()

      expect(apiFetch).toHaveBeenCalledWith(url, expect.objectContaining({ headers: { Accept: "application/json" } }))
      const [ blob, downloadedFilename ] = downloadBlob.mock.calls[0]
      expect(downloadedFilename).toBe(filename)
      expect(await blob.text()).toBe(JSON.stringify({ foo: "bar" }, null, 2))
    })

    it("swallows a thrown error instead of leaving an unhandled rejection", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
      apiFetch.mockRejectedValue(new Error("network down"))
      const controller = buildModalController()
      controller.currentCaseId = "5"
      controller.currentCaseName = "Movies"
      controller.selectedFormat = "general"

      await expect(controller.submit()).resolves.toBeUndefined()

      expect(consoleSpy).toHaveBeenCalled()
      expect(downloadBlob).not.toHaveBeenCalled()
    })

    it("logs when the server responds with a non-2xx status instead of failing silently", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
      apiFetch.mockResolvedValue({ ok: false, status: 500 })
      const controller = buildModalController()
      controller.currentCaseId = "5"
      controller.currentCaseName = "Movies"
      controller.selectedFormat = "ltr"

      await controller.submit()

      expect(consoleSpy).toHaveBeenCalled()
      expect(downloadBlob).not.toHaveBeenCalled()
    })
  })
})
