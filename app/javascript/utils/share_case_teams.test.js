import { describe, expect, it } from "vitest"
import { parseTeamsJson, partitionTeams } from "./share_case_teams"

// partitionTeams mirrors Angular ShareCaseModalInstanceCtrl teamHasCase / addTeamToLists logic.

describe("parseTeamsJson", () => {
  it("parses a JSON array string", () => {
    expect(parseTeamsJson('[{"id":1,"name":"A"}]')).toEqual([{ id: 1, name: "A" }])
  })

  it("returns [] for empty or invalid input", () => {
    expect(parseTeamsJson("")).toEqual([])
    expect(parseTeamsJson("not-json")).toEqual([])
    expect(parseTeamsJson({})).toEqual([])
  })
})

describe("partitionTeams", () => {
  const teams = [
    { id: 1, name: "Shared", cases: [{ case_id: 42 }] },
    { id: 2, name: "Other", cases: [{ caseNo: 99 }] },
    { id: 3, name: "Empty", cases: [] }
  ]

  it("partitions by case_id on team.cases", () => {
    const { allTeams, sharedTeams } = partitionTeams(teams, 42)
    expect(allTeams.map((t) => t.id)).toEqual([1, 2, 3])
    expect(sharedTeams).toEqual([{ id: 1, name: "Shared" }])
  })

  it("partitions by caseNo on team.cases", () => {
    const { sharedTeams } = partitionTeams(teams, 99)
    expect(sharedTeams).toEqual([{ id: 2, name: "Other" }])
  })

  it("treats missing cases as unshared", () => {
    const { sharedTeams } = partitionTeams(teams, 42)
    expect(sharedTeams.some((t) => t.id === 3)).toBe(false)
  })
})
