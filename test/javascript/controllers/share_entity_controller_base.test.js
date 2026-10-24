import { buildControllerFixture } from "../support/controller_fixture"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import ShareEntityControllerBase from "controllers/share_entity_controller_base"
import ShareBookController from "controllers/share_book_controller"
import ShareCaseController from "controllers/share_case_controller"
import ShareScorerController from "controllers/share_scorer_controller"
import ShareSearchEndpointController from "controllers/share_search_endpoint_controller"

class ShareWidgetController extends ShareEntityControllerBase {
  get entityLabel() {
    return "Widget"
  }
}

function template(html) {
  const element = document.createElement("template")
  element.innerHTML = html
  return element
}

const TARGETS = {
  frame: () => document.createElement("turbo-frame"),
  loading: () => template('<p role="status">Loading teams…</p>'),
  loadError: () => template('<div role="alert">Unable to load teams. Please try again.</div>'),
  unshareTeamId: () => document.createElement("input"),
  title: () => document.createElement("h5"),
  submitButton: () => document.createElement("button"),
  unshareButton: () => document.createElement("button")
}

// The modal: every target present unless listed in `without`.
function buildModal({ without = [] } = {}) {
  const controller = buildControllerFixture(ShareWidgetController, {
    targets: Object.fromEntries(Object.entries(TARGETS).map(([name, make]) => [
      name, without.includes(name) ? null : make()
    ])),
    overrides: {
      identifier: "share-widget"
    }
  })
  controller.connect()
  return controller
}

// What ShareModalsController renders into the frame for a record shared with `teams`.
function loadFrame(controller, teams) {
  const select = document.createElement("select")
  select.innerHTML = '<option value="">Select a team...</option><option value="3">Relevance</option>'
  const list = document.createElement("div")
  for (const team of teams) {
    const row = document.createElement("button")
    row.type = "button"
    row.dataset.teamId = team.id
    row.setAttribute("data-share-widget-team-id-param", String(team.id))
    row.dataset.action = "click->share-widget#selectSharedTeam"
    list.appendChild(row)
  }
  controller.frameTarget.replaceChildren(select, list)
  Object.assign(controller, {
    teamSelectTarget: select,
    hasTeamSelectTarget: true,
    sharedListTarget: list,
    hasSharedListTarget: true
  })
  return [...list.children]
}

// A plain Bootstrap trigger: no controller, just the data attributes the modal reads.
function buildTrigger(attributes) {
  const trigger = document.createElement("button")
  for (const [name, value] of Object.entries(attributes)) {
    trigger.setAttribute(`data-share-widget-${name}-value`, value)
  }
  return trigger
}

// The Stimulus stub does not route data-action, so resolve the row's declared
// action and typed param the way Stimulus would.
function clickRow(controller, row) {
  const [, identifier, method] = row.dataset.action.match(/^click->([\w-]+)#(\w+)$/)
  const teamId = JSON.parse(row.getAttribute(`data-${identifier}-team-id-param`))
  controller[method]({ type: "click", currentTarget: row, params: { teamId } })
}

describe("ShareEntityControllerBase", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("titles the modal with the entity label and record name", () => {
    const controller = buildModal()

    controller.openWith({ name: "Shoes", url: "share_modals/widget/42" })

    expect(controller.titleTarget.textContent).toBe("Share Widget: Shoes")
  })

  it("titles the modal without a name", () => {
    const controller = buildModal()

    controller.openWith({ url: "share_modals/widget/42" })

    expect(controller.titleTarget.textContent).toBe("Share Widget")
  })

  it("loads the record's forms into the frame, showing the loading state meanwhile", () => {
    const controller = buildModal()
    loadFrame(controller, [{ id: 1 }])

    controller.openWith({ name: "Shoes", url: "share_modals/widget/42" })

    expect(controller.frameTarget.getAttribute("src")).toBe("share_modals/widget/42")
    expect(controller.frameTarget.textContent).toBe("Loading teams…")
    expect(controller.frameTarget.querySelector("select")).toBe(null)
  })

  it("reassigns the frame source when reopened for the same record", () => {
    const controller = buildModal()
    controller.openWith({ url: "share_modals/widget/42" })
    const setAttribute = vi.spyOn(controller.frameTarget, "setAttribute")

    controller.openWith({ url: "share_modals/widget/42" })

    expect(setAttribute).toHaveBeenCalledWith("src", "share_modals/widget/42")
  })

  it("shows the error state instead of Turbo's message when the response has no frame", () => {
    const controller = buildModal()
    controller.openWith({ url: "share_modals/widget/42" })
    const event = { type: "turbo:frame-missing", preventDefault: vi.fn() }

    controller.loadFailed(event)

    expect(event.preventDefault).toHaveBeenCalled()
    expect(controller.frameTarget.querySelector("[role=alert]").textContent)
      .toBe("Unable to load teams. Please try again.")
    expect(controller.frameTarget.querySelector("[role=status]")).toBe(null)
  })

  it("shows the error state when the request fails, leaving Turbo's own handling in place", () => {
    const controller = buildModal()
    controller.openWith({ url: "share_modals/widget/42" })
    const event = { type: "turbo:fetch-request-error", preventDefault: vi.fn() }

    controller.loadFailed(event)

    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(controller.frameTarget.querySelector("[role=alert]")).not.toBe(null)
  })

  it("replaces a previous error with the loading state when reopened", () => {
    const controller = buildModal()
    controller.loadFailed({ type: "turbo:fetch-request-error", preventDefault() {} })

    controller.openWith({ url: "share_modals/widget/42" })

    expect(controller.frameTarget.querySelector("[role=alert]")).toBe(null)
    expect(controller.frameTarget.textContent).toBe("Loading teams…")
  })

  it("disables both submit buttons until the new forms arrive", () => {
    const controller = buildModal()
    controller.submitButtonTarget.disabled = false
    controller.unshareButtonTarget.disabled = false

    controller.openWith({ url: "share_modals/widget/42" })

    expect(controller.submitButtonTarget.disabled).toBe(true)
    expect(controller.unshareButtonTarget.disabled).toBe(true)
  })

  it("enables share only while a team is selected", () => {
    const controller = buildModal()
    controller.openWith({ url: "share_modals/widget/42" })
    loadFrame(controller, [])

    controller.toggleSubmit()
    expect(controller.submitButtonTarget.disabled).toBe(true)

    controller.teamSelectTarget.value = "3"
    controller.toggleSubmit()
    expect(controller.submitButtonTarget.disabled).toBe(false)
  })

  it("selects a team to unshare by clicking its row, and moves the selection on another click", () => {
    const controller = buildModal()
    const [osc, search] = loadFrame(controller, [{ id: 1 }, { id: 2 }])

    clickRow(controller, osc)
    expect(osc.classList.contains("active")).toBe(true)
    expect(controller.unshareTeamIdTarget.value).toBe("1")
    expect(controller.unshareButtonTarget.disabled).toBe(false)

    clickRow(controller, search)
    expect(osc.classList.contains("active")).toBe(false)
    expect(search.classList.contains("active")).toBe(true)
    expect(controller.unshareTeamIdTarget.value).toBe("2")

    clickRow(controller, search)
    expect(search.classList.contains("active")).toBe(false)
    expect(controller.unshareTeamIdTarget.value).toBe("")
    expect(controller.unshareButtonTarget.disabled).toBe(true)
  })

  it("clears a pending unshare selection when reopened for another record", () => {
    const controller = buildModal()
    clickRow(controller, loadFrame(controller, [{ id: 1 }])[0])

    controller.openWith({ url: "share_modals/widget/2" })

    expect(controller.selectedSharedTeamId).toBe(null)
    expect(controller.unshareButtonTarget.disabled).toBe(true)
  })

  it("on show, reads the clicked trigger's data attributes into the modal", () => {
    const modal = buildModal()
    const trigger = buildTrigger({ id: "5", name: "Boots", url: "share_modals/widget/5" })

    modal.open({ target: modal.element, relatedTarget: trigger })

    expect(modal.titleTarget.textContent).toBe("Share Widget: Boots")
    expect(modal.frameTarget.getAttribute("src")).toBe("share_modals/widget/5")
  })

  it("opens blank when shown without a trigger", () => {
    const modal = buildModal()

    modal.open({ target: modal.element })

    expect(modal.titleTarget.textContent).toBe("Share Widget")
  })

  it("ignores show events bubbling up from a nested modal", () => {
    const modal = buildModal()
    const openWith = vi.spyOn(modal, "openWith")

    modal.open({ target: document.createElement("div"), relatedTarget: buildTrigger({ id: "5" }) })

    expect(openWith).not.toHaveBeenCalled()
  })

  it("tolerates a modal that only renders some of its targets", () => {
    const bare = buildModal({ without: Object.keys(TARGETS) })
    expect(() => {
      bare.openWith({ name: "Shoes", url: "share_modals/widget/1" })
      bare.toggleSubmit()
      bare.toggleUnshareSubmit()
      bare.loadFailed({ type: "turbo:frame-missing", preventDefault() {} })
    }).not.toThrow()

    const noTemplate = buildModal({ without: ["loading"] })
    noTemplate.openWith({ url: "share_modals/widget/1" })
    expect(noTemplate.frameTarget.getAttribute("src")).toBe("share_modals/widget/1")
  })

  it("lets unshare work in a modal without a hidden team-id field", () => {
    const controller = buildModal({ without: ["unshareTeamId"] })
    const row = loadFrame(controller, [{ id: 1 }, { id: 2 }])[1]

    clickRow(controller, row)

    expect(controller.unshareButtonTarget.disabled).toBe(false)
    expect(row.classList.contains("active")).toBe(true)
  })
})

describe.each([
  ["share-book", ShareBookController, "Book", "book"],
  ["share-case", ShareCaseController, "Case", "case"],
  ["share-scorer", ShareScorerController, "Scorer", "scorer"],
  ["share-search-endpoint", ShareSearchEndpointController, "Search Endpoint", "search_endpoint"]
])("%s — Rails index / team page subclass", (identifier, ControllerClass, label, recordType) => {
  it("titles the modal with its entity label and loads the trigger's frame URL", () => {
    const controller = buildControllerFixture(ControllerClass, {
      targets: {
        title: document.createElement("h5"),
        frame: document.createElement("turbo-frame"),
        submitButton: document.createElement("button"),
        unshareButton: document.createElement("button")
      },
      overrides: { identifier }
    })
    controller.connect()
    const trigger = document.createElement("button")
    trigger.setAttribute(`data-${identifier}-name-value`, "Index Record")
    trigger.setAttribute(`data-${identifier}-url-value`, `share_modals/${recordType}/5`)

    controller.open({ target: controller.element, relatedTarget: trigger })

    expect(controller.titleTarget.textContent).toBe(`Share ${label}: Index Record`)
    expect(controller.frameTarget.getAttribute("src")).toBe(`share_modals/${recordType}/5`)
    expect(controller.submitButtonTarget.disabled).toBe(true)
    expect(controller.unshareButtonTarget.disabled).toBe(true)
  })
})
