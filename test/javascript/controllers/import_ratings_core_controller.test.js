import { beforeEach, describe, expect, it, vi } from "vitest"
import ImportRatingsCoreController from "controllers/import_ratings_core_controller"
import { apiFetch } from "api/fetch"
import { getOrCreateBsModal, hideBsModal, showBsModal } from "utils/bs_modal"
import coreFlash from "utils/core_flash"

vi.mock("api/fetch", () => ({ apiFetch: vi.fn() }))
vi.mock("utils/bs_modal", () => ({
  getOrCreateBsModal: vi.fn(() => ({ show: vi.fn(), hide: vi.fn() })),
  showBsModal: vi.fn(),
  hideBsModal: vi.fn()
}))
vi.mock("utils/core_flash", () => ({ default: { show: vi.fn() } }))

function controller() {
  const instance = Object.create(ImportRatingsCoreController.prototype)
  instance.caseIdValue = 6
  instance.selectedType = ""
  instance.contents = {}
  instance.errors = {}
  instance.files = {}
  instance.busy = false
  return instance
}

// A controller wired to a modal shaped like shared/_import_ratings_core_modal.
function modalController() {
  const element = document.createElement("div")
  element.id = "importRatingsModal"
  element.innerHTML = `
    <h5 data-target="title"></h5>
    <div data-target="alert" class="d-none"></div>
    <div data-target="warning" class="d-none"></div>
    <input type="checkbox" data-target="clearQueries">
    <input type="checkbox" data-target="createQueries">
    <div><input type="radio" value="csv"><input type="file" data-import-type="csv"><pre data-target="csvPreview"></pre></div>
    <div><input type="radio" value="rre"><input type="file" data-import-type="rre"><pre data-target="content" data-import-ratings-core-target="content"></pre></div>
    <div><input type="radio" value="ltr"><input type="file" data-import-type="ltr"><pre data-target="content" data-import-ratings-core-target="content"></pre></div>
    <div><input type="file" data-import-type="information_needs"><pre data-target="informationNeedsPreview"></pre></div>
    <div><input type="file" data-import-type="snapshots"><pre data-target="snapshotsPreview"></pre></div>
    <div data-target="loading"></div>
    <button data-target="importButton" disabled></button>`
  document.body.appendChild(element)

  const instance = Object.create(ImportRatingsCoreController.prototype)
  instance.element = element
  instance.caseIdValue = 6
  instance.ratingsUrlValue = "/api/import/ratings"
  instance.informationNeedsUrlValue = "/api/import/queries/information_needs"
  instance.snapshotsUrlValue = "/api/cases/6/snapshots/imports"
  const target = (name) => element.querySelector(`[data-target="${name}"]`)
  for (const name of [
    "title",
    "alert",
    "warning",
    "clearQueries",
    "createQueries",
    "csvPreview",
    "informationNeedsPreview",
    "snapshotsPreview",
    "loading",
    "importButton"
  ]) {
    instance[`has${name[0].toUpperCase()}${name.slice(1)}Target`] = true
    instance[`${name}Target`] = target(name)
  }
  instance.fileTargets = [...element.querySelectorAll("input[type=file]")]
  instance.formatTargets = [...element.querySelectorAll("input[type=radio]")]
  instance.contentTargets = [...element.querySelectorAll('[data-target="content"]')]
  instance.initialize()
  return instance
}

function fileInput(instance, type) {
  return instance.element.querySelector(`input[type=file][data-import-type="${type}"]`)
}

async function chooseFile(instance, type, content) {
  const input = fileInput(instance, type)
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [new File([content], `ratings.${type}`)]
  })
  await instance.fileSelected({ currentTarget: input })
  return input
}

function respond(body, { ok = true, status = 200, statusText = "OK" } = {}) {
  apiFetch.mockResolvedValue({ text: async function () { return JSON.stringify(await this.json()) || "" },  ok, status, statusText, json: () => Promise.resolve(body) })
}

function postedRequests() {
  return apiFetch.mock.calls.map(([url, options]) => ({ url, ...options, body: JSON.parse(options.body) }))
}

const RATINGS_CSV = 'query,docid,rating\n"shoes, red",doc-1,3\nboots,doc-2,0\n'
const SNAPSHOTS_HEADER = "Snapshot Name,Snapshot Time,Case ID,Query Text,Doc ID,Doc Position"

describe("ImportRatingsCoreController", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ""
  })

  it("parses quoted CSV values and preserves headers", () => {
    const instance = controller()
    const parsed = instance.parseCsv('query,docid,rating\n"star wars, original",123,3\n')

    expect(parsed.headers).toEqual(["query", "docid", "rating"])
    expect(parsed.rows).toEqual([{ query: "star wars, original", docid: "123", rating: "3" }])
  })

  it("validates the expected headers for each import format", () => {
    const instance = controller()

    expect(instance.validate("csv", "query,docid\nfoo,1")).toBe(
      "Headers mismatch! Please make sure you have the correct headers: query,docid,rating"
    )
    expect(instance.validate("snapshots", "Snapshot Name,Query Text\nBase,dog")).toBe(
      `Headers mismatch! Please make sure you have the correct headers: ${SNAPSHOTS_HEADER}`
    )
    expect(instance.validate("information_needs", "query,information_need\nfoo,bar")).toBe("")
    expect(instance.validate("csv", "query,docid,rating\nfoo,1,2")).toBe("")
    expect(instance.validate("rre", "not json")).toBe("Invalid RRE JSON file.")
    expect(instance.validate("rre", '{"queries":[]}')).toBe("")
  })

  it.each([
    ["ltr", "  \n"],
    ["csv", " \n "]
  ])("rejects an empty %s file", (type, content) => {
    expect(controller().validate(type, content)).toBe("The selected file is empty.")
  })

  it("accepts any non-empty LTR file", () => {
    expect(controller().validate("ltr", "3 qid:1 # doc-1 shoes")).toBe("")
  })

  it("rejects a CSV with headers but no data rows", () => {
    expect(controller().validate("csv", "query,docid,rating\n")).toBe("The selected file has no data rows.")
  })

  it("rejects malformed rows with line-specific errors", () => {
    const instance = controller()

    expect(instance.validate("csv", "query,docid,rating\nfoo,doc-1,2,unexpected")).toBe(
      "CSV format error: line 2: expected 3 columns but found 4."
    )
    expect(instance.validate("csv", 'query,docid,rating\n"foo,doc-1,2')).toContain("unclosed quote")
  })

  it("hides the Importing row when the modal is reset after a successful import", () => {
    const instance = controller()
    instance.element = document.createElement("div")
    instance.hasLoadingTarget = true
    instance.loadingTarget = document.createElement("div")
    instance.fileTargets = []
    instance.formatTargets = []
    instance.contentTargets = []
    instance.hasAlertTarget = false
    instance.hasWarningTarget = false
    instance.hasImportButtonTarget = false

    instance.setBusy(true)
    expect(instance.loadingTarget.classList.contains("d-none")).toBe(false)

    instance.reset()

    expect(instance.busy).toBe(false)
    expect(instance.loadingTarget.classList.contains("d-none")).toBe(true)
  })

  it("starts with the Importing row hidden", () => {
    const instance = modalController()

    expect(instance.loadingTarget.classList.contains("d-none")).toBe(true)
    expect(instance.selectedType).toBe("")
    expect(instance.busy).toBe(false)
  })

  it("reads the current case name from the header when opening", () => {
    const instance = controller()
    instance.reset = vi.fn()
    instance.hasTitleTarget = true
    instance.titleTarget = document.createElement("h5")
    document.body.innerHTML =
      '<turbo-frame id="case_header"><div data-case-header-case-name="Renamed case"></div></turbo-frame>'

    instance.openFor(null)

    expect(instance.titleTarget.textContent).toBe("Import into Case: Renamed case")
    expect(instance.reset).toHaveBeenCalledOnce()
  })

  it("leaves showing the modal to Bootstrap when it opens", () => {
    const instance = modalController()

    instance.openFor(null)

    expect(showBsModal).not.toHaveBeenCalled()
  })

  it("clears everything from the previous import when reopened", async () => {
    const instance = modalController()
    await chooseFile(instance, "rre", "not json")
    instance.clearQueriesTarget.checked = true
    instance.createQueriesTarget.checked = true
    instance.element.querySelector("input[type=radio]").checked = true
    const preview = instance.contentTargets[0]
    expect(preview.textContent).toBe("not json")

    instance.reset()

    expect(instance.selectedType).toBe("")
    expect(instance.files).toEqual({})
    expect(instance.contents).toEqual({})
    expect(instance.errors).toEqual({})
    expect(preview.textContent).toBe("")
    expect(instance.alertTarget.textContent).toBe("")
    expect(instance.alertTarget.classList.contains("d-none")).toBe(true)
    expect(instance.clearQueriesTarget.checked).toBe(false)
    expect(instance.createQueriesTarget.checked).toBe(false)
    expect(instance.element.querySelector("input[type=radio]").checked).toBe(false)
    expect(instance.importButtonTarget.disabled).toBe(true)
  })

  it("shows the override warning only while an import type is selected", () => {
    const instance = modalController()

    instance.selectType({ target: { value: "ltr" } })
    expect(instance.selectedType).toBe("ltr")
    expect(instance.warningTarget.classList.contains("d-none")).toBe(false)
    expect(instance.importButtonTarget.disabled).toBe(true)

    instance.clearSelection()
    expect(instance.selectedType).toBe("")
    expect(instance.warningTarget.classList.contains("d-none")).toBe(true)
  })

  it("words the override warning for the selected import type", () => {
    const instance = modalController()
    instance.hasWarningTextTarget = true
    instance.warningTextTarget = document.createElement("span")

    instance.selectType({ target: { value: "csv" } })
    expect(instance.warningTextTarget.textContent).toContain("override your existing ratings")
    instance.selectType({ target: { value: "information_needs" } })
    expect(instance.warningTextTarget.textContent).toContain("override your existing information needs")
    instance.selectType({ target: { value: "snapshots" } })
    expect(instance.warningTextTarget.textContent).toContain("same Snapshot Name")
  })

  it("selects the file's type, previews it, and enables Import for a valid file", async () => {
    const instance = modalController()

    await chooseFile(instance, "csv", RATINGS_CSV)

    expect(instance.selectedType).toBe("csv")
    expect(instance.files.csv.name).toBe("ratings.csv")
    expect(instance.contents.csv).toBe(RATINGS_CSV)
    expect(instance.csvPreviewTarget.textContent).toBe(RATINGS_CSV)
    expect(instance.alertTarget.classList.contains("d-none")).toBe(true)
    expect(instance.importButtonTarget.disabled).toBe(false)
  })

  it.each([
    ["information_needs", "informationNeedsPreviewTarget", "query,information_need\nshoes,red ones\n"],
    ["snapshots", "snapshotsPreviewTarget", `${SNAPSHOTS_HEADER}\nBase,2026-09-01,6,dog,doc-1,1\n`]
  ])("previews a %s file in its own pane", async (type, preview, content) => {
    const instance = modalController()

    await chooseFile(instance, type, content)

    expect(instance[preview].textContent).toBe(content)
    expect(instance.importButtonTarget.disabled).toBe(false)
  })

  it("previews RRE and LTR files next to their own file input", async () => {
    const instance = modalController()

    const input = await chooseFile(instance, "ltr", "3 qid:1 # doc-1")

    expect(input.parentElement.querySelector('[data-target="content"]').textContent).toBe("3 qid:1 # doc-1")
    expect(instance.contentTargets[0].textContent).toBe("")
  })

  it("shows the validation error and keeps Import disabled for an invalid file", async () => {
    const instance = modalController()

    await chooseFile(instance, "csv", "query,docid\nshoes,doc-1\n")

    expect(instance.alertTarget.textContent).toContain("Headers mismatch!")
    expect(instance.alertTarget.classList.contains("d-none")).toBe(false)
    expect(instance.importButtonTarget.disabled).toBe(true)
  })

  it("ignores a file dialog that was cancelled", async () => {
    const instance = modalController()
    const input = fileInput(instance, "csv")
    Object.defineProperty(input, "files", { value: [] })

    await instance.fileSelected({ currentTarget: input })

    expect(instance.selectedType).toBe("")
    expect(instance.contents).toEqual({})
  })

  it("shows a read failure even when no import type was chosen first", async () => {
    const instance = modalController()
    vi.spyOn(File.prototype, "text").mockRejectedValueOnce(new Error("unreadable"))

    await chooseFile(instance, "csv", RATINGS_CSV)

    expect(instance.alertTarget.textContent).toBe("Unable to read this file. Please try again.")
    expect(instance.alertTarget.classList.contains("d-none")).toBe(false)
    expect(instance.importButtonTarget.disabled).toBe(true)
  })

  it("posts CSV ratings as rows, with the clear-queries choice", async () => {
    respond({})
    const instance = modalController()
    await chooseFile(instance, "csv", RATINGS_CSV)
    instance.clearQueriesTarget.checked = true

    await instance.submit({ preventDefault: vi.fn() })

    expect(postedRequests()).toEqual([
      {
        url: "/api/import/ratings?file_format=hash",
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: {
          ratings: [
            { query_text: "shoes, red", doc_id: "doc-1", rating: "3" },
            { query_text: "boots", doc_id: "doc-2", rating: "0" }
          ],
          case_id: 6,
          clear_queries: true
        }
      }
    ])
    expect(coreFlash.show).toHaveBeenCalledWith("success", "Successfully imported ratings from CSV.")
  })

  it.each([
    ["rre", '{"queries":[]}', "rre_json", "Successfully imported ratings from RRE."],
    ["ltr", "3 qid:1 # doc-1", "ltr_text", "Successfully imported ratings from LTR."]
  ])("posts a %s file's raw text", async (type, content, field, message) => {
    respond({})
    const instance = modalController()
    await chooseFile(instance, type, content)

    await instance.submit({ preventDefault: vi.fn() })

    expect(postedRequests()[0].url).toBe(`/api/import/ratings?file_format=${type}`)
    expect(postedRequests()[0].body).toEqual({ [field]: content, case_id: 6, clear_queries: false })
    expect(coreFlash.show).toHaveBeenCalledWith("success", message)
  })

  it("posts information needs with the create-missing-queries choice", async () => {
    respond({})
    const instance = modalController()
    const content = "query,information_need\nshoes,red ones\n"
    await chooseFile(instance, "information_needs", content)
    instance.createQueriesTarget.checked = true

    await instance.submit({ preventDefault: vi.fn() })

    expect(postedRequests()).toMatchObject([
      {
        url: "/api/import/queries/information_needs",
        body: { csv_text: content, case_id: 6, create_queries: true }
      }
    ])
    expect(coreFlash.show).toHaveBeenCalledWith("success", "Successfully imported information needs from CSV.")
  })

  it("posts each snapshot separately, grouping docs by query in file order", async () => {
    respond({})
    const instance = modalController()
    await chooseFile(
      instance,
      "snapshots",
      [
        `${SNAPSHOTS_HEADER},Title`,
        "Baseline,2026-09-01T12:00:00Z,99,dog,doc-1,1,Good dog",
        'Tuned,2026-09-02T12:00:00Z,99,"shoes, red",doc-9,1,Red',
        "Baseline,2026-09-01T12:00:00Z,99,dog,doc-2,2,Bad dog",
        "Baseline,2026-09-01T12:00:00Z,99,cat,doc-3,1,Cat"
      ].join("\n")
    )

    await instance.submit({ preventDefault: vi.fn() })

    const requests = postedRequests()
    expect(requests.map((request) => request.url)).toEqual([
      "/api/cases/6/snapshots/imports",
      "/api/cases/6/snapshots/imports"
    ])
    expect(requests[0].body).toEqual({
      snapshots: [
        {
          name: "Baseline",
          created_at: "2026-09-01T12:00:00Z",
          queries: {
            dog: {
              docs: [
                { id: "doc-1", position: "1", fields: { Title: "Good dog" } },
                { id: "doc-2", position: "2", fields: { Title: "Bad dog" } }
              ]
            },
            cat: { docs: [{ id: "doc-3", position: "1", fields: { Title: "Cat" } }] }
          }
        }
      ]
    })
    expect(requests[1].body.snapshots[0]).toMatchObject({ name: "Tuned", queries: { "shoes, red": {} } })
    expect(coreFlash.show).toHaveBeenCalledWith("success", "Snapshots imported successfully!")
  })

  it("groups snapshot rows and carries additional document fields", async () => {
    const instance = controller()
    instance.selectedType = "snapshots"
    instance.contents.snapshots = [
      `${SNAPSHOTS_HEADER},Title`,
      "Baseline,2026-09-01T12:00:00Z,99,dog,doc-1,1,Good dog"
    ].join("\n")
    instance.post = vi.fn().mockResolvedValue({})

    await instance.importSnapshots()

    expect(instance.post).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        snapshots: [
          expect.objectContaining({
            name: "Baseline",
            queries: { dog: { docs: [{ id: "doc-1", position: "1", fields: { Title: "Good dog" } }] } }
          })
        ]
      })
    )
  })

  it("reloads the case's queries and closes the modal after a successful import", async () => {
    respond({})
    const instance = modalController()
    const reload = vi.fn()
    document.addEventListener("imports:queries-need-reload", reload)
    await chooseFile(instance, "csv", RATINGS_CSV)

    await instance.submit({ preventDefault: vi.fn() })

    document.removeEventListener("imports:queries-need-reload", reload)
    expect(reload).toHaveBeenCalledOnce()
    expect(reload.mock.calls[0][0].detail).toEqual({ caseId: 6 })
    expect(hideBsModal).toHaveBeenCalledOnce()
    expect(getOrCreateBsModal).toHaveBeenLastCalledWith(instance.element)
    expect(instance.busy).toBe(true)
    expect(instance.loadingTarget.classList.contains("d-none")).toBe(false)
  })

  it("flashes the server's error and lets the user retry", async () => {
    respond({ message: "Unknown case" }, { ok: false, status: 404, statusText: "Not Found" })
    const instance = modalController()
    await chooseFile(instance, "csv", RATINGS_CSV)

    await instance.submit({ preventDefault: vi.fn() })

    expect(coreFlash.show).toHaveBeenCalledWith("error", "Unknown case")
    expect(hideBsModal).not.toHaveBeenCalled()
    expect(instance.busy).toBe(false)
    expect(instance.loadingTarget.classList.contains("d-none")).toBe(true)
    expect(instance.importButtonTarget.disabled).toBe(false)
  })

  it.each([
    ["the message", { message: "Bad file", error: "ignored" }, "Not Found", "Bad file"],
    ["the error", { error: "Bad rating" }, "Not Found", "Bad rating"],
    ["the status text", {}, "Unprocessable Content", "Unprocessable Content"],
    ["a generic message", {}, "", "Import failed."]
  ])("reports %s when an import request fails", async (_label, body, statusText, expected) => {
    respond(body, { ok: false, status: 422, statusText })

    await expect(controller().post("/api/import/ratings", {})).rejects.toThrow(expected)
  })

  it("falls back to the status text when the error response isn't JSON", async () => {
    apiFetch.mockResolvedValue({
      async text() {
        return JSON.stringify(await this.json()) || ""
      },
      ok: false,
      statusText: "Bad Gateway",
      json: () => Promise.reject(new SyntaxError("Unexpected token <"))
    })

    await expect(controller().post("/api/import/ratings", {})).rejects.toThrow("Bad Gateway")
  })

  it("returns the parsed body of a successful request", async () => {
    respond({ imported: 2 })

    await expect(controller().post("/api/import/ratings", {})).resolves.toEqual({ imported: 2 })
  })

  it("uses a generic message for errors without one", () => {
    expect(controller().errorMessage(new Error(""))).toBe("Import failed. Please try again.")
  })

  it.each([
    ["nothing is selected", {}],
    ["the selected file is invalid", { selectedType: "csv", contents: { csv: "x" }, errors: { csv: "bad" } }],
    ["an import is already running", { selectedType: "csv", contents: { csv: RATINGS_CSV }, busy: true }]
  ])("does not import when %s", async (_label, state) => {
    const instance = Object.assign(controller(), state)
    const event = { preventDefault: vi.fn() }

    await instance.submit(event)

    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(apiFetch).not.toHaveBeenCalled()
  })

  it("keeps Import disabled while an import is running", async () => {
    const instance = modalController()
    await chooseFile(instance, "csv", RATINGS_CSV)

    instance.setBusy(true)

    expect(instance.importButtonTarget.disabled).toBe(true)
  })
})
