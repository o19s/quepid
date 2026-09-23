import { describe, expect, it, vi } from "vitest"
import {
  bootstrapRequest,
  bulkCreateRequest,
  createRequest,
  deleteRequest,
  moveRequest,
  positionRequest,
  persistQuery,
  persistQueries
} from "utils/query_lifecycle"

describe("query_lifecycle", () => {
  it("builds the bootstrap request", () => {
    expect(bootstrapRequest(42)).toEqual({
      method: "GET",
      url: "api/cases/42/queries",
      params: { bootstrap: true }
    })
  })

  it("builds single and bulk create requests", () => {
    expect(createRequest(42, "star wars")).toEqual({
      method: "POST",
      url: "api/cases/42/queries",
      data: { query: { query_text: "star wars" } }
    })
    expect(bulkCreateRequest(42, ["star wars", "dune"])).toEqual({
      method: "POST",
      url: "api/bulk/cases/42/queries",
      data: { queries: ["star wars", "dune"] }
    })
  })

  it("builds reorder, delete, and move requests", () => {
    expect(positionRequest(42, 7, 6, true)).toEqual({
      method: "PUT",
      url: "api/cases/42/queries/7/position",
      data: { after: 6, reverse: true }
    })
    expect(deleteRequest(42, 7)).toEqual({
      method: "DELETE",
      url: "api/cases/42/queries/7"
    })
    expect(moveRequest({ caseNo: 42, queryId: 7 }, 99)).toEqual({
      method: "PUT",
      url: "api/cases/42/queries/7",
      data: { other_case_id: 99 }
    })
  })

  it("persists a single query and returns its response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ query: { query_id: 7 }, display_order: [7] }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    )))

    await expect(persistQuery(42, "star wars")).resolves.toEqual({
      status: 201,
      data: { query: { query_id: 7 }, display_order: [7] }
    })
    expect(fetch).toHaveBeenCalledWith("api/cases/42/queries", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ query: { query_text: "star wars" } })
    }))
    vi.unstubAllGlobals()
  })

  it("persists bulk queries and surfaces API errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: "Unable to add queries." }),
      { status: 422, headers: { "Content-Type": "application/json" } }
    )))

    await expect(persistQueries(42, ["star wars", "dune"])).rejects.toEqual({
      error: "Unable to add queries."
    })
    vi.unstubAllGlobals()
  })
})
