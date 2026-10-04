import { beforeEach, describe, expect, it, vi } from "vitest"
import { getJson } from "api/json"
import { createScorerCatalog } from "utils/scorer_catalog"

vi.mock("api/json", () => ({ getJson: vi.fn() }))

describe("scorer catalog", () => {
  beforeEach(() => vi.clearAllMocks())

  it("starts with a default built from the shared runtime", () => {
    const catalog = createScorerCatalog()

    expect(catalog.getDefault().scale).toEqual(["0", "1"])
    expect(catalog.getDefault().score).toEqual(expect.any(Function))
  })

  it("bootstraps the case default from the API", async () => {
    getJson.mockResolvedValue({ default: { scorer_id: 7, name: "P@10", scale: [0, 1, 2, 3] } })
    const catalog = createScorerCatalog()

    await catalog.bootstrap(42)

    expect(getJson).toHaveBeenCalledWith("api/cases/42/scorers")
    expect(catalog.getDefault()).toEqual(expect.objectContaining({ scorerId: 7, name: "P@10", scale: [0, 1, 2, 3] }))
  })

  it("resets to a fresh default when the case has no configured scorer", async () => {
    getJson.mockResolvedValue({})
    const catalog = createScorerCatalog()
    await catalog.select({ scorer_id: 3 })

    await catalog.bootstrap(42)

    expect(catalog.getDefault().scorerId).toBeUndefined()
  })

  it("selects a scorer from API data as the new default", async () => {
    const catalog = createScorerCatalog()

    const selected = await catalog.select({ scorer_id: 9, name: "DCG@10" })

    expect(selected).toBe(catalog.getDefault())
    expect(selected).toEqual(expect.objectContaining({ scorerId: 9, displayName: "DCG@10" }))
  })

  it("builds every scorer with the shared scorer options", async () => {
    const schedule = vi.fn((callback) => callback())
    const catalog = createScorerCatalog({ scorerOptions: { schedule } })
    await catalog.select({ code: "setScore(5)" })

    await expect(catalog.getDefault().score({ ratedDocs: [] }, 1, [], [])).resolves.toBe(5)
    expect(schedule).toHaveBeenCalledOnce()
  })
})
