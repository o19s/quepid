import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { apiFetch } from "api/fetch"
import ImportSnapshotController from "controllers/import_snapshot_controller"
import { buildSnapshotCsv } from "utils/case_csv"

vi.mock("api/fetch", () => ({
  apiFetch: vi.fn(),
}))

describe("ImportSnapshotController sendSnapshotToAPI", () => {
  beforeEach(() => {
    document.body.dataset.quepidRootUrl = "https://example.com/quepid"
  })

  afterEach(() => {
    vi.clearAllMocks()
    delete document.body.dataset.quepidRootUrl
  })

  it("builds the import URL under the quepid root, not a bare /api path", async () => {
    const controller = Object.create(ImportSnapshotController.prototype)
    apiFetch.mockResolvedValue({
      async text() {
        return JSON.stringify(await this.json()) || ""
      },
      ok: true,
      json: () => Promise.resolve({}),
    })

    await ImportSnapshotController.prototype.sendSnapshotToAPI.call(controller, "4", { name: "Snap A" })

    expect(apiFetch).toHaveBeenCalledWith(
      "https://example.com/quepid/api/cases/4/snapshots/imports",
      expect.objectContaining({ method: "POST" })
    )
  })
})

describe("ImportSnapshotController importSnapshots", () => {
  it("groups rows into a queries hash keyed by query text, not an array", async () => {
    const controller = Object.create(ImportSnapshotController.prototype)
    controller.sendSnapshotToAPI = vi.fn().mockResolvedValue({})

    const rows = [
      { "Case ID": "4", "Snapshot Name": "Snap A", "Snapshot Time": "2026-09-01T12:00:00Z", "Query Text": "dog", "Doc ID": "doc1", "Doc Position": "1" },
      { "Case ID": "4", "Snapshot Name": "Snap A", "Snapshot Time": "2026-09-01T12:00:00Z", "Query Text": "dog", "Doc ID": "doc2", "Doc Position": "2" },
      { "Case ID": "4", "Snapshot Name": "Snap A", "Snapshot Time": "2026-09-01T12:00:00Z", "Query Text": "cat", "Doc ID": "doc3", "Doc Position": "1" }
    ]

    await ImportSnapshotController.prototype.importSnapshots.call(controller, rows)

    expect(controller.sendSnapshotToAPI).toHaveBeenCalledOnce()
    const [caseId, payload] = controller.sendSnapshotToAPI.mock.calls[0]

    expect(caseId).toBe("4")
    expect(payload.name).toBe("Snap A")
    expect(Array.isArray(payload.queries)).toBe(false)
    expect(payload.queries.dog.docs).toEqual([
      { id: "doc1", position: "1" },
      { id: "doc2", position: "2" }
    ])
    expect(payload.queries.cat.docs).toEqual([ { id: "doc3", position: "1" } ])
  })

  it("sends multiple snapshots for the same case sequentially, not concurrently", async () => {
    const controller = Object.create(ImportSnapshotController.prototype)

    let inFlight = 0
    let concurrentCallsSeen = 0
    controller.sendSnapshotToAPI = vi.fn().mockImplementation(async () => {
      inFlight += 1
      if (inFlight > 1) concurrentCallsSeen += 1
      await new Promise(resolve => setTimeout(resolve, 0))
      inFlight -= 1
      return {}
    })

    const rows = [
      { "Case ID": "4", "Snapshot Name": "Snap A", "Snapshot Time": "2026-09-01T12:00:00Z", "Query Text": "dog", "Doc ID": "doc1", "Doc Position": "1" },
      { "Case ID": "4", "Snapshot Name": "Snap B", "Snapshot Time": "2026-09-01T13:00:00Z", "Query Text": "dog", "Doc ID": "doc2", "Doc Position": "1" }
    ]

    await ImportSnapshotController.prototype.importSnapshots.call(controller, rows)

    expect(controller.sendSnapshotToAPI).toHaveBeenCalledTimes(2)
    expect(concurrentCallsSeen).toBe(0)
  })

  it("counts failures without aborting remaining snapshots, and still throws", async () => {
    const controller = Object.create(ImportSnapshotController.prototype)
    controller.sendSnapshotToAPI = vi.fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({})

    const rows = [
      { "Case ID": "4", "Snapshot Name": "Snap A", "Snapshot Time": "2026-09-01T12:00:00Z", "Query Text": "dog", "Doc ID": "doc1", "Doc Position": "1" },
      { "Case ID": "4", "Snapshot Name": "Snap B", "Snapshot Time": "2026-09-01T13:00:00Z", "Query Text": "dog", "Doc ID": "doc2", "Doc Position": "1" }
    ]

    await expect(
      ImportSnapshotController.prototype.importSnapshots.call(controller, rows)
    ).rejects.toThrow("1 snapshot(s) failed to import")

    expect(controller.sendSnapshotToAPI).toHaveBeenCalledTimes(2)
  })
})

const HEADER = "Snapshot Name,Snapshot Time,Case ID,Query Text,Doc ID,Doc Position"

function uiController() {
  const controller = Object.create(ImportSnapshotController.prototype)
  controller.alertTarget = document.createElement("div")
  controller.submitButtonTarget = document.createElement("button")
  controller.submitTextTarget = document.createElement("span")
  controller.spinnerTarget = document.createElement("span")
  controller.previewTarget = document.createElement("div")
  controller.previewTarget.classList.add("d-none")
  controller.previewContentTarget = document.createElement("pre")
  controller.fileInputTarget = { files: [] }
  return controller
}

const csvFile = (content, name = "snap.csv", type = "text/csv") => new File([content], name, { type })

describe("ImportSnapshotController file selection", () => {
  afterEach(() => vi.restoreAllMocks())

  it("rejects non-CSV files and disables Import", async () => {
    const controller = uiController()

    await controller.fileSelected({ target: { files: [csvFile("x", "notes.txt", "text/plain")] } })

    expect(controller.alertTarget.textContent).toBe("Please select a valid CSV file.")
    expect(controller.alertTarget.className).toBe("alert alert-danger")
    expect(controller.submitButtonTarget.disabled).toBe(true)
    expect(controller.previewTarget.classList.contains("d-none")).toBe(true)
  })

  it("previews a valid CSV, accepted by extension, and enables Import", async () => {
    const controller = uiController()
    controller.alertTarget.classList.remove("d-none")
    const content = `${HEADER}\nBaseline,2026-09-28,4,star wars,a,1`

    await controller.fileSelected({ target: { files: [csvFile(content, "export.csv", "")] } })

    expect(controller.submitButtonTarget.disabled).toBe(false)
    expect(controller.previewContentTarget.textContent).toBe(content)
    expect(controller.previewTarget.classList.contains("d-none")).toBe(false)
    expect(controller.alertTarget.classList.contains("d-none")).toBe(true)
  })

  it("shows why a CSV is invalid and hides any earlier preview", async () => {
    const controller = uiController()
    controller.previewTarget.classList.remove("d-none")

    await controller.fileSelected({ target: { files: [csvFile("Snapshot Name,Case ID\nBaseline,4")] } })

    expect(controller.alertTarget.textContent).toContain("Missing required headers: Snapshot Time, Query Text, Doc ID, Doc Position.")
    expect(controller.submitButtonTarget.disabled).toBe(true)
    expect(controller.previewTarget.classList.contains("d-none")).toBe(true)
  })

  it("reports a file that can't be read, and resets when the selection is cleared", async () => {
    const controller = uiController()
    controller.readFileAsText = vi.fn(() => Promise.reject(new Error("io")))

    await controller.fileSelected({ target: { files: [csvFile("x")] } })
    expect(controller.alertTarget.textContent).toBe("Error reading file. Please try again.")

    controller.submitButtonTarget.disabled = false
    await controller.fileSelected({ target: { files: [] } })
    expect(controller.submitButtonTarget.disabled).toBe(true)
  })

  it("requires the header plus at least one data row", () => {
    const controller = uiController()

    expect(controller.validateCSV(`${HEADER}\n`)).toEqual({ valid: false, error: "CSV file is empty or has no data rows." })
    expect(controller.validateCSV(` ${HEADER} \nBaseline,t,4,q,a,1`)).toEqual({ valid: true })
  })

  it("shows the first 10 lines of a long file and counts the rest", () => {
    const controller = uiController()
    const lines = Array.from({ length: 13 }, (_, i) => `line ${i + 1}`)

    controller.showPreview(lines.join("\n"))

    expect(controller.previewContentTarget.textContent).toBe(`${lines.slice(0, 10).join("\n")}\n... (3 more lines)`)
  })
})

describe("ImportSnapshotController submit", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it("asks for a file first", async () => {
    const controller = uiController()

    await controller.submit({ preventDefault: vi.fn() })

    expect(controller.alertTarget.textContent).toBe("Please select a file to import.")
    expect(controller.alertTarget.className).toBe("alert alert-warning")
  })

  it("refuses a file with a malformed row instead of importing the rest", async () => {
    const controller = uiController()
    controller.importSnapshots = vi.fn()
    controller.fileInputTarget.files = [csvFile(`${HEADER}\nBaseline,t,4,q,a,1\nBaseline,t,4`)]

    await controller.submit({ preventDefault: vi.fn() })

    expect(controller.importSnapshots).not.toHaveBeenCalled()
    expect(controller.alertTarget.textContent).toBe("CSV format error: line 3: expected 6 columns but found 3.")
    expect(controller.submitButtonTarget.disabled).toBe(false)
  })

  it("imports the parsed rows, shows progress, then reloads", async () => {
    vi.useFakeTimers()
    const reload = vi.fn()
    vi.spyOn(window, "location", "get").mockReturnValue({ reload })
    const controller = uiController()
    controller.importSnapshots = vi.fn(() => Promise.resolve())
    controller.fileInputTarget.files = [csvFile(`${HEADER}\n Baseline , 2026-09-28 ,4,star wars,a,1`)]

    const submitting = controller.submit({ preventDefault: vi.fn() })
    expect(controller.submitTextTarget.textContent).toBe("Importing...")
    expect(controller.spinnerTarget.classList.contains("d-none")).toBe(false)
    await submitting

    expect(controller.importSnapshots).toHaveBeenCalledWith([{
      "Snapshot Name": "Baseline", "Snapshot Time": "2026-09-28", "Case ID": "4", "Query Text": "star wars", "Doc ID": "a", "Doc Position": "1"
    }])
    expect(controller.alertTarget.textContent).toBe("Snapshots imported successfully! Refreshing...")
    vi.advanceTimersByTime(1500)
    expect(reload).toHaveBeenCalledOnce()
  })

  it("shows the import error and restores the button", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const controller = uiController()
    controller.importSnapshots = vi.fn(() => Promise.reject(new Error("2 snapshot(s) failed to import.")))
    controller.fileInputTarget.files = [csvFile(`${HEADER}\nBaseline,t,4,q,a,1`)]

    await controller.submit({ preventDefault: vi.fn() })

    expect(controller.alertTarget.textContent).toBe("2 snapshot(s) failed to import.")
    expect(controller.submitTextTarget.textContent).toBe("Import")
    expect(controller.spinnerTarget.classList.contains("d-none")).toBe(true)
    expect(controller.submitButtonTarget.disabled).toBe(false)
  })

  it("surfaces the server's message when a snapshot import is rejected", async () => {
    document.body.dataset.quepidRootUrl = "https://example.com/quepid"
    apiFetch.mockResolvedValueOnce({ text: async function () { return JSON.stringify(await this.json()) || "" },  ok: false, json: () => Promise.resolve({ message: "Case 4 not found" }) })
      .mockResolvedValueOnce({ text: async function () { return JSON.stringify(await this.json()) || "" },  ok: false, json: () => Promise.resolve({}) })
    const controller = uiController()

    await expect(controller.sendSnapshotToAPI("4", {})).rejects.toThrow("Case 4 not found")
    await expect(controller.sendSnapshotToAPI("5", {})).rejects.toThrow("Failed to import snapshot for case 5")
    expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toEqual({ snapshots: [{}] })
    delete document.body.dataset.quepidRootUrl
  })
})

describe("ImportSnapshotController round trip with the snapshot export", () => {
  it("imports every exported row, including values with commas, quotes, and extra doc fields", () => {
    const csv = buildSnapshotCsv(4, {
      name: "Baseline",
      time: "2026-09-28T12:00:00Z",
      queries: [{ query_id: 1, query_text: "star wars" }, { query_id: 2, query_text: "shoes, red" }],
      docs: {
        1: [{ id: "a", fields: { title: "A New Hope" } }, { id: "b", fields: { title: 'Episode IV, "A New Hope"' } }],
        2: [{ id: "c", fields: { title: "Red shoe" } }]
      }
    })
    const controller = uiController()

    expect(controller.validateCSV(csv)).toEqual({ valid: true })
    const rows = controller.parseCSV(csv)

    expect(rows.map((row) => [row["Query Text"], row["Doc ID"], row["Doc Position"], row.title])).toEqual([
      ["star wars", "a", "1", "A New Hope"],
      ["star wars", "b", "2", 'Episode IV, "A New Hope"'],
      ["shoes, red", "c", "1", "Red shoe"]
    ])
    expect(rows[0]["Case ID"]).toBe("4")
  })

  it("keeps a phrase query's quotes from both the current and the pre-8.7 export", () => {
    const current = buildSnapshotCsv(4, {
      name: "Baseline",
      time: "2026-09-28T12:00:00Z",
      queries: [{ query_id: 1, query_text: '"star wars"' }],
      docs: { 1: [{ id: "a", fields: {} }] }
    })
    // The AngularJS exporter doubled the quotes but didn't wrap the field.
    const legacy = `${HEADER}\r\n(9/28/26) Baseline,2026-09-28T12:00:00Z,4,""star wars"",a,1\r\n`
    const controller = uiController()

    for (const csv of [current, legacy]) {
      expect(controller.validateCSV(csv)).toEqual({ valid: true })
      expect(controller.parseCSV(csv)[0]["Query Text"]).toBe('"star wars"')
    }
  })

  it("names the line of a malformed row when validating", () => {
    const controller = uiController()

    expect(controller.validateCSV(`${HEADER}\nBaseline,t,4,"q, with comma",a,1,extra`)).toEqual({
      valid: false,
      error: "CSV format error: line 2: expected 6 columns but found 7."
    })
  })
})

