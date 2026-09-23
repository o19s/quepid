import { describe, expect, it } from "vitest"
import {
  bootstrapRequest,
  bulkCreateRequest,
  createRequest,
  deleteRequest,
  moveRequest,
  positionRequest
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
})
