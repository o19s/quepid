import { beforeEach, describe, expect, it, vi } from "vitest"
import ImportRatingsCoreController from "controllers/import_ratings_core_controller"

vi.mock("api/fetch", () => ({ apiFetch: vi.fn() }))
vi.mock("utils/bs_modal", () => ({
  getOrCreateBsModal: vi.fn(() => ({ show: vi.fn(), hide: vi.fn() })),
  showBsModal: vi.fn(),
  hideBsModal: vi.fn()
}))

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

describe("ImportRatingsCoreController", () => {
  beforeEach(() => vi.clearAllMocks())

  it("parses quoted CSV values and preserves headers", () => {
    const instance = controller()
    const parsed = instance.parseCsv('query,docid,rating\n"star wars, original",123,3\n')

    expect(parsed.headers).toEqual(["query", "docid", "rating"])
    expect(parsed.rows).toEqual([{ query: "star wars, original", docid: "123", rating: "3" }])
  })

  it("validates the expected headers for each import format", () => {
    const instance = controller()

    expect(instance.validate("csv", "query,docid\nfoo,1")).toContain("Headers mismatch")
    expect(instance.validate("information_needs", "query,information_need\nfoo,bar")).toBe("")
    expect(instance.validate("rre", "not json")).toBe("Invalid RRE JSON file.")
  })

  it("rejects malformed rows with line-specific errors", () => {
    const instance = controller()

    expect(instance.validate("csv", "query,docid,rating\nfoo,doc-1,2,unexpected")).toContain("line 2")
    expect(instance.validate("csv", "query,docid,rating\n\"foo,doc-1,2")).toContain("unclosed quote")
  })

  it("reads the current case name from the header when opening", () => {
    const instance = controller()
    instance.reset = vi.fn()
    instance.hasTitleTarget = true
    instance.titleTarget = document.createElement("h5")
    document.body.innerHTML = '<turbo-frame id="case_header"><div data-case-header-case-name="Renamed case"></div></turbo-frame>'

    instance.openAsRoot({ preventDefault: vi.fn() })

    expect(instance.titleTarget.textContent).toBe("Import into Case: Renamed case")
  })

  it("groups snapshot rows and carries additional document fields", async () => {
    const instance = controller()
    instance.selectedType = "snapshots"
    instance.contents.snapshots = [
      "Snapshot Name,Snapshot Time,Case ID,Query Text,Doc ID,Doc Position,Title",
      "Baseline,2026-09-01T12:00:00Z,99,dog,doc-1,1,Good dog"
    ].join("\n")
    instance.post = vi.fn().mockResolvedValue({})

    await instance.importSnapshots()

    expect(instance.post).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        snapshots: [expect.objectContaining({
          name: "Baseline",
          queries: { dog: { docs: [{ id: "doc-1", position: "1", fields: { Title: "Good dog" } }] } }
        })]
      })
    )
  })
})
