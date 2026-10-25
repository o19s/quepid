import { buildControllerFixture } from "../support/controller_fixture"
import { describe, expect, it } from "vitest"
import RelativeTimeController, { relativeTime } from "controllers/relative_time_controller"

const NOW = Date.parse("2026-10-13T12:00:00Z")

describe("relativeTime", () => {
  it("uses the largest whole unit", () => {
    expect(relativeTime("2026-10-13T11:59:58Z", NOW)).toBe("2 seconds ago")
    expect(relativeTime("2026-10-13T11:00:00Z", NOW)).toBe("1 hour ago")
    expect(relativeTime("2026-10-12T12:00:00Z", NOW)).toBe("yesterday")
    expect(relativeTime("2026-09-22T12:00:00Z", NOW)).toBe("3 weeks ago")
  })

  it("says now for the current moment", () => {
    expect(relativeTime("2026-10-13T12:00:00Z", NOW)).toBe("now")
  })

  it("is blank for a missing or invalid timestamp", () => {
    expect(relativeTime("", NOW)).toBe("")
    expect(relativeTime(null, NOW)).toBe("")
    expect(relativeTime("not a date", NOW)).toBe("")
  })
})

describe("RelativeTimeController", () => {
  it("formats its datetime when it connects", () => {
    const element = document.createElement("time")
    element.setAttribute("datetime", new Date(Date.now() - 5 * 60 * 1000).toISOString())
    const controller = buildControllerFixture(RelativeTimeController, { element })
    controller.connect()
    expect(element.textContent).toBe("5 minutes ago")
  })
})
