import { buildControllerFixture } from "../support/controller_fixture"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import TeamMemberAutocompleteController from "controllers/team_member_autocomplete_controller"

function buildController({ spinner = true } = {}) {
  const element = document.createElement("div")
  const input = document.createElement("input")
  const suggestions = document.createElement("div")
  const spinnerTarget = document.createElement("span")
  spinnerTarget.style.display = "none"
  element.append(input, suggestions, spinnerTarget)
  document.body.appendChild(element)

  const controller = buildControllerFixture(TeamMemberAutocompleteController, {
    element,
    targets: {
      input,
      suggestions,
      spinner: spinnerTarget
    },
    values: {
      url: "/teams/3/suggest_members",
      minLength: 2,
      debounceDelay: 300
    },
    overrides: {
      hasSpinnerTarget: spinner
    }
  })
  controller.connect()
  return controller
}

const users = [
  {
    email: "ada@example.com",
    display_name: "Ada Lovelace",
    avatar_url: "https://example.com/ada.png",
    matched_on: "email"
  },
  {
    email: "alan@example.com",
    display_name: "Alan Turing",
    avatar_url: "https://example.com/alan.png",
    matched_on: "name"
  }
]

function respondWith(body, { ok = true, status = 200 } = {}) {
  return vi.fn(() => Promise.resolve({ text: async function () { return JSON.stringify(await this.json()) || "" },  ok, status, json: () => Promise.resolve(body) }))
}

describe("TeamMemberAutocompleteController", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("waits for the debounce delay, then fetches with the encoded query", async () => {
    const fetch = respondWith(users)
    vi.stubGlobal("fetch", fetch)
    const controller = buildController()
    controller.inputTarget.value = "  a&b "

    controller.search()
    vi.advanceTimersByTime(299)
    expect(fetch).not.toHaveBeenCalled()
    expect(controller.spinnerTarget.style.display).toBe("none")

    vi.advanceTimersByTime(1)
    expect(controller.spinnerTarget.style.display).toBe("inline-block")
    expect(controller.isLoading).toBe(true)
    expect(fetch).toHaveBeenCalledWith("/teams/3/suggest_members?query=a%26b", {
      method: "GET",
      headers: { Accept: "application/json", "X-CSRF-Token": "", "X-Requested-With": "XMLHttpRequest" },
      signal: expect.any(AbortSignal)
    })

    await vi.runAllTimersAsync()
    expect(controller.spinnerTarget.style.display).toBe("none")
    expect(controller.isLoading).toBe(false)
    expect(controller.suggestions).toEqual(users)
  })

  it("only sends the last keystroke's query when typing quickly", () => {
    const fetch = respondWith(users)
    vi.stubGlobal("fetch", fetch)
    const controller = buildController()

    controller.inputTarget.value = "ad"
    controller.search()
    vi.advanceTimersByTime(200)
    controller.inputTarget.value = "ada"
    controller.search()
    vi.advanceTimersByTime(300)

    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch.mock.calls[0][0]).toBe("/teams/3/suggest_members?query=ada")
  })

  it("hides suggestions and cancels a pending search below the minimum length", () => {
    const fetch = respondWith(users)
    vi.stubGlobal("fetch", fetch)
    const controller = buildController()
    controller.showSuggestions(users)

    controller.inputTarget.value = "ad"
    controller.search()
    controller.inputTarget.value = " a "
    controller.search()
    vi.advanceTimersByTime(1000)

    expect(fetch).not.toHaveBeenCalled()
    expect(controller.suggestionsTarget.style.display).toBe("none")
    expect(controller.suggestionsTarget.innerHTML).toBe("")
    expect(controller.debounceTimer).toBe(null)
  })

  it("searches at exactly the minimum length", () => {
    const fetch = respondWith(users)
    vi.stubGlobal("fetch", fetch)
    const controller = buildController()

    controller.inputTarget.value = "ad"
    controller.search()
    vi.advanceTimersByTime(300)

    expect(fetch).toHaveBeenCalledOnce()
  })

  it("renders each user with avatar and name, and the email only for email matches", () => {
    const controller = buildController()

    controller.showSuggestions(users)

    const items = controller.suggestionsTarget.querySelectorAll(".autocomplete-item")
    expect(controller.suggestionsTarget.style.display).toBe("block")
    expect(items).toHaveLength(2)
    expect(items[0].dataset.email).toBe("ada@example.com")
    expect(items[0].dataset.action).toBe("click->team-member-autocomplete#select")
    const avatar = items[0].querySelector("img.autocomplete-avatar")
    expect(avatar.getAttribute("src")).toBe("https://example.com/ada.png")
    expect(avatar.alt).toBe("Ada Lovelace")
    expect(items[0].querySelector(".autocomplete-details .autocomplete-name").textContent).toBe(
      "Ada Lovelace"
    )
    expect(items[0].querySelector(".autocomplete-email").textContent).toBe("ada@example.com")
    expect(items[1].querySelector(".autocomplete-email")).toBe(null)
  })

  it("renders names as text, not HTML", () => {
    const controller = buildController()

    controller.showSuggestions([{ ...users[0], display_name: "<img src=x onerror=alert(1)>" }])

    expect(controller.suggestionsTarget.querySelector(".autocomplete-name img")).toBe(null)
    expect(controller.suggestionsTarget.querySelector(".autocomplete-name").textContent).toBe(
      "<img src=x onerror=alert(1)>"
    )
  })

  it("replaces earlier suggestions rather than appending", () => {
    const controller = buildController()

    controller.showSuggestions(users)
    controller.showSuggestions([users[1]])

    expect(controller.suggestionsTarget.children).toHaveLength(1)
    expect(controller.suggestionsTarget.textContent).toBe("Alan Turing")
  })

  it.each([
    ["an empty list", []],
    ["no data", null]
  ])("hides the dropdown when the server returns %s", (_label, body) => {
    const controller = buildController()
    controller.showSuggestions(users)

    controller.showSuggestions(body)

    expect(controller.suggestionsTarget.style.display).toBe("none")
    expect(controller.suggestionsTarget.innerHTML).toBe("")
  })

  it("fills the input with the clicked user's email and closes the dropdown", () => {
    const controller = buildController()
    controller.showSuggestions(users)
    const item = controller.suggestionsTarget.querySelectorAll(".autocomplete-item")[1]

    controller.select({ currentTarget: item })

    expect(controller.inputTarget.value).toBe("alan@example.com")
    expect(controller.suggestionsTarget.style.display).toBe("none")
    expect(controller.suggestions).toEqual([])
  })

  it.each([
    ["a non-OK response", () => respondWith(users, { text: async () => "", json: async () => null,  ok: false, status: 500 })],
    ["a network failure", () => vi.fn(() => Promise.reject(new Error("offline")))]
  ])("hides the spinner and dropdown after %s", async (_label, makeFetch) => {
    vi.stubGlobal("fetch", makeFetch())
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const controller = buildController()
    controller.showSuggestions(users)
    controller.showLoading()

    await controller.fetchSuggestions("ada")

    expect(error).toHaveBeenCalledOnce()
    expect(controller.spinnerTarget.style.display).toBe("none")
    expect(controller.isLoading).toBe(false)
    expect(controller.suggestionsTarget.style.display).toBe("none")
    expect(controller.suggestionsTarget.children).toHaveLength(0)
  })

  it("closes on clicks outside the widget but not inside it", () => {
    const controller = buildController()
    controller.showSuggestions(users)

    controller.clickOutside({ target: controller.inputTarget })
    expect(controller.suggestionsTarget.style.display).toBe("block")

    controller.clickOutside({ target: document.body })
    expect(controller.suggestionsTarget.style.display).toBe("none")
  })

  it("cancels a pending search on disconnect", () => {
    const fetch = respondWith(users)
    vi.stubGlobal("fetch", fetch)
    const controller = buildController()
    controller.inputTarget.value = "ada"
    controller.search()

    controller.disconnect()
    vi.advanceTimersByTime(1000)

    expect(fetch).not.toHaveBeenCalled()
    expect(controller.debounceTimer).toBe(null)
  })

  describe("overlapping requests", () => {
    function deferredFetch() {
      const pending = []
      const fetch = vi.fn((_url, init) => new Promise((resolve, reject) => {
        pending.push({
          init,
          resolve: (body) => resolve({ ok: true, status: 200, text: async () => JSON.stringify(body) })
        })
        init.signal.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"))
        })
      }))
      return { fetch, pending }
    }

    it("ignores a slow older response once a newer query has been sent", async () => {
      const { fetch, pending } = deferredFetch()
      vi.stubGlobal("fetch", fetch)
      const error = vi.spyOn(console, "error").mockImplementation(() => {})
      const controller = buildController()

      const older = controller.fetchSuggestions("ad")
      const newer = controller.fetchSuggestions("ada")
      expect(pending[0].init.signal.aborted).toBe(true)

      pending[1].resolve([users[1]])
      await newer
      pending[0].resolve(users)
      await older

      expect(error).not.toHaveBeenCalled()
      expect(controller.suggestions).toEqual([users[1]])
      expect(controller.suggestionsTarget.querySelectorAll(".autocomplete-item")).toHaveLength(1)
    })

    it("keeps the newer request's spinner when the older request is aborted", async () => {
      const { fetch, pending } = deferredFetch()
      vi.stubGlobal("fetch", fetch)
      const controller = buildController()

      controller.showLoading()
      const older = controller.fetchSuggestions("ad")
      controller.fetchSuggestions("ada")
      await older

      expect(controller.spinnerTarget.style.display).toBe("inline-block")
      expect(controller.isLoading).toBe(true)
      expect(pending).toHaveLength(2)
    })

    it("drops an in-flight response when input falls below the minimum length", async () => {
      const { fetch, pending } = deferredFetch()
      vi.stubGlobal("fetch", fetch)
      const controller = buildController()
      controller.inputTarget.value = "ada"
      controller.search()
      vi.advanceTimersByTime(300)

      controller.inputTarget.value = "a"
      controller.search()
      pending[0].resolve(users)
      await vi.runAllTimersAsync()

      expect(pending[0].init.signal.aborted).toBe(true)
      expect(controller.spinnerTarget.style.display).toBe("none")
      expect(controller.suggestionsTarget.style.display).toBe("none")
      expect(controller.suggestionsTarget.children).toHaveLength(0)
    })

    it("aborts an in-flight request on disconnect", async () => {
      const { fetch, pending } = deferredFetch()
      vi.stubGlobal("fetch", fetch)
      const error = vi.spyOn(console, "error").mockImplementation(() => {})
      const controller = buildController()

      const request = controller.fetchSuggestions("ada")
      controller.disconnect()
      await request

      expect(pending[0].init.signal.aborted).toBe(true)
      expect(error).not.toHaveBeenCalled()
      expect(controller.request).toBe(null)
    })
  })

  it("works without a spinner target", async () => {
    vi.stubGlobal("fetch", respondWith(users))
    const controller = buildController({ spinner: false })

    controller.showLoading()
    expect(controller.isLoading).toBe(false)
    expect(controller.spinnerTarget.style.display).toBe("none")

    controller.isLoading = true
    await controller.fetchSuggestions("ada")
    expect(controller.isLoading).toBe(true)
    expect(controller.suggestionsTarget.querySelectorAll(".autocomplete-item")).toHaveLength(2)
  })
})
