import { describe, expect, it, vi } from "vitest"
import { fetchQueries, moveQuery, persistQuery, persistQueries } from "utils/query_lifecycle"

describe("query_lifecycle", () => {
  it("loads the case's queries for bootstrap", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ queries: [] }), { status: 200 })))

    await expect(fetchQueries(42)).resolves.toEqual({ queries: [] })
    expect(fetch).toHaveBeenCalledWith("api/cases/42/queries?bootstrap=true", expect.objectContaining({ method: "GET" }))
    vi.unstubAllGlobals()
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

    await expect(persistQueries(42, ["star wars", "dune"])).rejects.toMatchObject({
      status: 422,
      data: { error: "Unable to add queries." }
    })
    vi.unstubAllGlobals()
  })

  it("persists a move, resolving a 204 with its status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("", { status: 204 })))

    await expect(moveQuery(42, 7, 99)).resolves.toEqual({ status: 204, data: null })

    expect(fetch).toHaveBeenCalledWith("api/cases/42/queries/7", expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({ other_case_id: 99 })
    }))
    vi.unstubAllGlobals()
  })
})
