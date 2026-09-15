import { describe, expect, it } from "vitest"
import {
  deactivateListItem,
  parseTeamsJson,
  partitionTeams,
  unsharedTeams
} from "./share_case_teams"

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

describe("unsharedTeams", () => {
  it("returns teams from allTeams not present in sharedTeams", () => {
    const allTeams = [{ id: 1 }, { id: 2 }, { id: 3 }]
    const sharedTeams = [{ id: 2 }]
    expect(unsharedTeams(allTeams, sharedTeams).map((t) => t.id)).toEqual([1, 3])
  })

  it("compares ids as strings", () => {
    const allTeams = [{ id: "1" }, { id: 2 }]
    const sharedTeams = [{ id: 1 }]
    expect(unsharedTeams(allTeams, sharedTeams)).toEqual([{ id: 2 }])
  })

  it("returns all teams when none are shared", () => {
    const allTeams = [{ id: 1 }, { id: 2 }]
    expect(unsharedTeams(allTeams, [])).toEqual(allTeams)
  })
})

describe("deactivateListItem", () => {
  function buildList() {
    const list = document.createElement("div")
    const item = document.createElement("button")
    item.dataset.teamId = "5"
    item.classList.add("active")
    list.appendChild(item)
    return { list, item }
  }

  it("removes the active class from the matching item", () => {
    const { list, item } = buildList()
    deactivateListItem(list, "5")
    expect(item.classList.contains("active")).toBe(false)
  })

  it("does nothing when teamId is falsy", () => {
    const { list, item } = buildList()
    deactivateListItem(list, null)
    expect(item.classList.contains("active")).toBe(true)
  })

  it("does nothing when listElement is missing", () => {
    expect(() => deactivateListItem(null, "5")).not.toThrow()
  })
})
