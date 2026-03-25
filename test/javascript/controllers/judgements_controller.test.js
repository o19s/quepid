import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { Application } from "@hotwired/stimulus"
import JudgementsController from "../../../app/javascript/controllers/judgements_controller"
import { waitForController } from "../support/stimulus_helpers"

describe("JudgementsController", () => {
  let application
  const books = [
    { id: 1, name: "Star Wars Judgements" },
    { id: 2, name: "Bond Judgements" },
  ]
  const teams = [{ id: 10, name: "Search Team" }]

  beforeEach(async () => {
    document.head.innerHTML = '<meta name="csrf-token" content="test-csrf">'
    document.body.setAttribute("data-quepid-root-url", "")

    document.body.innerHTML = `
      <div data-controller="judgements"
           data-judgements-case-id-value="42"
           data-judgements-book-id-value="1"
           data-judgements-auto-populate-book-pairs-value="false"
           data-judgements-auto-populate-case-judgements-value="true"
           data-judgements-scorer-id-value="5"
           data-judgements-queries-count-value="10"
           data-judgements-teams-value='${JSON.stringify(teams)}'
           data-judgements-books-value='${JSON.stringify(books)}'>

        <a href="#" data-action="click->judgements#open">Judgements</a>

        <div class="modal fade" tabindex="-1" data-judgements-target="modal">
          <div class="modal-body">
            <div class="d-none" data-judgements-target="noTeamsMessage">No teams</div>
            <div class="d-none" data-judgements-target="noBooksMessage">
              <a data-judgements-target="createBookLink" href="#">Create</a>
            </div>
            <div data-judgements-target="bookList"></div>
            <div class="d-none" data-judgements-target="noBookHint">Select a book</div>

            <div class="d-none" data-judgements-target="integrationPanel">
              <input type="checkbox" data-judgements-target="autoPopulateBookPairsCheckbox"
                     data-action="change->judgements#toggleSetting">
              <input type="checkbox" data-judgements-target="autoPopulateCaseJudgementsCheckbox"
                     data-action="change->judgements#toggleSetting">
              <button data-judgements-target="populateButton" disabled
                      data-action="click->judgements#manualPopulate">Populate</button>
              <button data-judgements-target="refreshButton" disabled
                      data-action="click->judgements#manualRefresh">Refresh</button>
              <button data-judgements-target="syncQueriesButton" disabled
                      data-action="click->judgements#manualSyncQueries">Sync</button>
            </div>

            <div class="d-none" data-judgements-target="errorMessage"></div>
            <div class="d-none" data-judgements-target="processingMessage">
              <span></span><span></span>
            </div>
          </div>
          <div class="modal-footer">
            <a data-judgements-target="createBookLink" href="#">Create</a>
            <a class="d-none" data-judgements-target="judgeLink" href="#">Judge</a>
            <button class="d-none" data-judgements-target="saveButton"
                    data-action="click->judgements#save">Save</button>
          </div>
        </div>
      </div>
    `

    window.bootstrap = {
      Modal: {
        getOrCreateInstance: vi.fn(() => ({
          show: vi.fn(),
          hide: vi.fn(),
        })),
      },
    }

    // Mock fetch for _refreshBooks — return the same books that were server-rendered
    globalThis.fetch = vi.fn((url) => {
      if (String(url).includes("/books")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ books }),
        })
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) })
    })

    application = Application.start()
    application.register("judgements", JudgementsController)
    await waitForController(application, "[data-controller='judgements']", "judgements")
  })

  afterEach(() => {
    application.stop()
    delete window.bootstrap
    vi.restoreAllMocks()
  })

  it("connects with correct initial values", () => {
    const el = document.querySelector("[data-controller='judgements']")
    const controller = application.getControllerForElementAndIdentifier(el, "judgements")
    expect(controller).not.toBeNull()
    expect(controller._selectedBookId).toBe(1)
  })

  it("opens modal and renders book list with proper ul wrapper", async () => {
    const el = document.querySelector("[data-controller='judgements']")
    const controller = application.getControllerForElementAndIdentifier(el, "judgements")
    await controller.open()

    const bookList = document.querySelector("[data-judgements-target='bookList']")
    expect(bookList.classList.contains("d-none")).toBe(false)

    // Should have a proper <ul> wrapper
    const ul = bookList.querySelector("ul.list-group")
    expect(ul).not.toBeNull()

    // Should have "None" + 2 books = 3 list items
    const items = ul.querySelectorAll(".list-group-item")
    expect(items.length).toBe(3)
  })

  it("shows integration panel when book is selected", async () => {
    const el = document.querySelector("[data-controller='judgements']")
    const controller = application.getControllerForElementAndIdentifier(el, "judgements")
    await controller.open()

    const panel = document.querySelector("[data-judgements-target='integrationPanel']")
    expect(panel.classList.contains("d-none")).toBe(false)
  })

  it("hides integration panel when None is selected", async () => {
    const el = document.querySelector("[data-controller='judgements']")
    const controller = application.getControllerForElementAndIdentifier(el, "judgements")
    await controller.open()

    // Select "None"
    controller.selectBook({ currentTarget: { dataset: { bookId: "" } } })

    const panel = document.querySelector("[data-judgements-target='integrationPanel']")
    expect(panel.classList.contains("d-none")).toBe(true)
  })

  it("shows save button when book selection changes", async () => {
    const el = document.querySelector("[data-controller='judgements']")
    const controller = application.getControllerForElementAndIdentifier(el, "judgements")
    await controller.open()

    // Select a different book
    controller.selectBook({ currentTarget: { dataset: { bookId: "2" } } })

    const saveBtn = document.querySelector("[data-judgements-target='saveButton']")
    expect(saveBtn.classList.contains("d-none")).toBe(false)
  })

  it("hides save button when original book is reselected", async () => {
    const el = document.querySelector("[data-controller='judgements']")
    const controller = application.getControllerForElementAndIdentifier(el, "judgements")
    await controller.open()

    // Select different then back to original
    controller.selectBook({ currentTarget: { dataset: { bookId: "2" } } })
    controller.selectBook({ currentTarget: { dataset: { bookId: "1" } } })

    const saveBtn = document.querySelector("[data-judgements-target='saveButton']")
    expect(saveBtn.classList.contains("d-none")).toBe(true)
  })

  it("updates create book links with correct URL", async () => {
    const el = document.querySelector("[data-controller='judgements']")
    const controller = application.getControllerForElementAndIdentifier(el, "judgements")
    await controller.open()

    const links = document.querySelectorAll("[data-judgements-target='createBookLink']")
    links.forEach((link) => {
      expect(link.href).toContain("/books/new?scorer_id=5&origin_case_id=42")
    })
  })

  it("shows no-teams message when no teams", async () => {
    // Reconfigure with empty teams
    const wrapper = document.querySelector("[data-controller='judgements']")
    wrapper.setAttribute("data-judgements-teams-value", "[]")
    wrapper.setAttribute("data-judgements-books-value", "[]")

    // Need to reconnect
    application.stop()
    application = Application.start()
    application.register("judgements", JudgementsController)
    await waitForController(application, "[data-controller='judgements']", "judgements")

    const el = document.querySelector("[data-controller='judgements']")
    const controller = application.getControllerForElementAndIdentifier(el, "judgements")
    expect(controller).not.toBeNull()

    await controller.open()
    const noTeams = document.querySelector("[data-judgements-target='noTeamsMessage']")
    expect(noTeams.classList.contains("d-none")).toBe(false)
  })
})
