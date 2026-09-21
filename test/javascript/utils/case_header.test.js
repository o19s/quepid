import { beforeEach, describe, expect, it } from "vitest"
import { caseNameFromHeader } from "utils/case_header"
import { mountCaseHeader } from "../support/case_header_dom"

/**
 * The server-rendered case header is the single source of truth for the case name on the core
 * case page. The toolbar's modal triggers used to each carry their own copy, which then had to be
 * resynced after every rename; they read through this helper instead.
 */
describe("caseNameFromHeader", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  it("reads the name the header is currently carrying", () => {
    mountCaseHeader("Movies Case")

    expect(caseNameFromHeader()).toBe("Movies Case")
  })

  it("picks up a rename applied to the header after load", () => {
    const frame = mountCaseHeader("Old Name")
    expect(caseNameFromHeader()).toBe("Old Name")

    // What case-toolbar does when Angular renames the case.
    frame.querySelector("[data-case-header-case-name]")
      .setAttribute("data-case-header-case-name", "New Name")

    expect(caseNameFromHeader()).toBe("New Name")
  })

  it("returns an empty string when the header is absent", () => {
    expect(caseNameFromHeader()).toBe("")
  })

  it("returns an empty string for a case whose name is empty", () => {
    mountCaseHeader("")

    expect(caseNameFromHeader()).toBe("")
  })

  // A same-named element outside the frame must not be mistaken for the header.
  it("ignores a matching element that is not inside the header frame", () => {
    const stray = document.createElement("div")
    stray.setAttribute("data-case-header-case-name", "Not The Header")
    document.body.appendChild(stray)

    expect(caseNameFromHeader()).toBe("")
  })

  /*
   * Deliberately anchored on the data attribute, not on the rendered heading: that heading's
   * element is a Stimulus target private to `case-rename` and free to be renamed.
   */
  it("does not depend on the rendered heading element", () => {
    const frame = mountCaseHeader("Movies Case")
    frame.querySelector('[data-case-rename-target="caseDisplay"]').remove()

    expect(caseNameFromHeader()).toBe("Movies Case")
  })
})
