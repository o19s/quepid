import { describe, expect, it } from "vitest"
import { withBusy } from "utils/busy_button"

function button(html) {
  const element = document.createElement("button")
  element.innerHTML = html
  return element
}

describe("withBusy", () => {
  it("disables the button only while the work runs and returns its result", async () => {
    const element = button("Save")
    let disabledDuring

    const result = await withBusy(element, async () => {
      disabledDuring = element.disabled
      return "done"
    })

    expect(disabledDuring).toBe(true)
    expect(result).toBe("done")
    expect(element.disabled).toBe(false)
    expect(element.innerHTML).toBe("Save")
  })

  it("shows a spinner and label while busy, then restores the original content", async () => {
    const element = button('<i class="bi bi-cloud"></i> Fetch')
    let during

    await withBusy(element, async () => {
      during = element.innerHTML
    }, { label: "Loading..." })

    expect(during).toBe('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...')
    expect(element.innerHTML).toBe('<i class="bi bi-cloud"></i> Fetch')
  })

  it("re-enables and restores the button when the work throws", async () => {
    const element = button("Generate")

    await expect(withBusy(element, async () => { throw new Error("offline") }, { label: "Loading..." }))
      .rejects.toThrow("offline")

    expect(element.disabled).toBe(false)
    expect(element.innerHTML).toBe("Generate")
  })
})
