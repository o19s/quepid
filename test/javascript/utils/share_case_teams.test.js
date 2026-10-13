import { describe, expect, it } from "vitest"
import { deactivateListItem } from "utils/share_case_teams"

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
