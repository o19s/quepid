import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { Application } from "@hotwired/stimulus"

// Mock modules/editor to avoid CodeMirror dependency chain in tests
vi.mock("modules/editor", () => ({
  fromTextArea: vi.fn((textarea) => ({
    getValue: () => textarea.value,
    setValue: vi.fn(),
    view: {
      dom: document.createElement("div"),
      requestMeasure: vi.fn(),
      destroy: vi.fn(),
    },
  })),
}))

import SettingsPanelController from "../../../app/javascript/controllers/settings_panel_controller"
import { waitForController } from "../support/stimulus_helpers"

describe("SettingsPanelController", () => {
  let application

  function mountHtml() {
    document.body.dataset.quepidRootUrl = "http://localhost:3000"
    document.body.innerHTML = `
      <meta name="csrf-token" content="test-token" />
      <div id="dev-settings" data-controller="settings-panel"
           data-settings-panel-case-id-value="42"
           data-settings-panel-try-number-value="3"
           data-settings-panel-try-id-value="99"
           data-settings-panel-search-engine-value="solr"
           data-settings-panel-query-params-value="q=#$query##"
           data-settings-panel-field-spec-value="title id"
           data-settings-panel-number-of-rows-value="10"
           data-settings-panel-escape-query-value="true"
           data-settings-panel-search-endpoint-id-value="5"
           data-settings-panel-curator-vars-value="{}"
           data-settings-panel-total-tries-value="3">

        <ul class="nav nav-tabs">
          <li class="tabBoxSelected" data-action="click->settings-panel#switchTab"
              data-settings-panel-target="tab" data-tab="query">Query</li>
          <li data-action="click->settings-panel#switchTab"
              data-settings-panel-target="tab" data-tab="tuning">Tuning Knobs</li>
          <li data-action="click->settings-panel#switchTab"
              data-settings-panel-target="tab" data-tab="settings">Settings</li>
          <li data-action="click->settings-panel#switchTab"
              data-settings-panel-target="tab" data-tab="history">History</li>
          <li data-action="click->settings-panel#switchTab"
              data-settings-panel-target="tab" data-tab="annotations">Annotations</li>
        </ul>

        <div data-settings-panel-target="tabContent" data-tab="query">
          <div class="alert d-none" data-settings-panel-target="warning"></div>
          <textarea data-settings-panel-target="queryParamsInput"
                    data-action="input->settings-panel#markDirty input->settings-panel#extractCuratorVars">q=#$query##</textarea>
          <div data-settings-panel-target="validationWarnings"></div>
        </div>
        <div class="d-none" data-settings-panel-target="tabContent" data-tab="tuning">
          <p data-settings-panel-target="curatorVarsHelp">Use ##variableName##...</p>
          <div data-settings-panel-target="curatorVarsContainer"></div>
        </div>
        <div class="d-none" data-settings-panel-target="tabContent" data-tab="settings">
          <select data-settings-panel-target="endpointSelect"
                  data-action="change->settings-panel#selectEndpoint">
            <option value="5" selected>My Endpoint</option>
          </select>
          <div data-settings-panel-target="endpointInfo"></div>
          <div class="d-none" data-settings-panel-target="endpointWarning"></div>
          <input value="title id" data-settings-panel-target="fieldSpecInput"
                 data-action="input->settings-panel#markDirty" />
          <input type="number" value="10" data-settings-panel-target="numberOfRowsInput"
                 data-action="input->settings-panel#markDirty" />
          <input type="checkbox" checked data-settings-panel-target="escapeQueryInput"
                 data-action="change->settings-panel#markDirty" />
        </div>
        <div class="d-none" data-settings-panel-target="tabContent" data-tab="history">
          <ul data-settings-panel-target="tryHistory">
            <li class="try-history-item" data-try-number="3" data-settings-panel-target="tryItem">
              <div class="try-history-main">
                <a href="#" class="try-history-link">
                  <span class="try-number">#3</span>
                  <span class="try-name" data-settings-panel-target="tryName">Try 3</span>
                </a>
                <button class="try-actions-toggle" data-action="click->settings-panel#toggleTryActions">&hellip;</button>
              </div>
              <div class="try-actions d-none">
                <button data-action="click->settings-panel#renameTry" data-try-number="3">Rename</button>
                <button data-action="click->settings-panel#duplicateTry" data-try-number="3">Duplicate</button>
                <button data-action="click->settings-panel#deleteTry" data-try-number="3">Delete</button>
              </div>
              <div class="try-details d-none"><small>Fields: title id</small></div>
            </li>
          </ul>
        </div>
        <div class="d-none" data-settings-panel-target="tabContent" data-tab="annotations">
          <textarea data-settings-panel-target="annotationMessage"></textarea>
          <div data-settings-panel-target="annotationsList"></div>
        </div>

        <div data-settings-panel-target="submitArea">
          <button data-action="click->settings-panel#submit"
                  data-settings-panel-target="submitButton">Rerun My Searches!</button>
        </div>
      </div>
    `
  }

  beforeEach(async () => {
    mountHtml()
    application = Application.start()
    application.register("settings-panel", SettingsPanelController)
    await waitForController(application, '[data-controller="settings-panel"]', "settings-panel")
  })

  afterEach(() => {
    application.stop()
  })

  it("connects and initializes as not dirty", () => {
    const ctrl = application.getControllerForElementAndIdentifier(
      document.querySelector('[data-controller="settings-panel"]'),
      "settings-panel",
    )
    expect(ctrl.dirty).toBe(false)
  })

  it("switchTab shows selected tab content and hides others", () => {
    const ctrl = application.getControllerForElementAndIdentifier(
      document.querySelector('[data-controller="settings-panel"]'),
      "settings-panel",
    )
    const settingsTab = ctrl.tabTargets.find((t) => t.dataset.tab === "settings")
    ctrl.switchTab({ currentTarget: settingsTab })

    const queryContent = ctrl.tabContentTargets.find((c) => c.dataset.tab === "query")
    const settingsContent = ctrl.tabContentTargets.find((c) => c.dataset.tab === "settings")
    const historyContent = ctrl.tabContentTargets.find((c) => c.dataset.tab === "history")

    expect(queryContent.classList.contains("d-none")).toBe(true)
    expect(settingsContent.classList.contains("d-none")).toBe(false)
    expect(historyContent.classList.contains("d-none")).toBe(true)
  })

  it("switchTab hides submit area on history tab", () => {
    const ctrl = application.getControllerForElementAndIdentifier(
      document.querySelector('[data-controller="settings-panel"]'),
      "settings-panel",
    )
    const historyTab = ctrl.tabTargets.find((t) => t.dataset.tab === "history")
    ctrl.switchTab({ currentTarget: historyTab })

    expect(ctrl.submitAreaTarget.classList.contains("d-none")).toBe(true)
  })

  it("markDirty sets dirty flag", () => {
    const ctrl = application.getControllerForElementAndIdentifier(
      document.querySelector('[data-controller="settings-panel"]'),
      "settings-panel",
    )
    expect(ctrl.dirty).toBe(false)
    ctrl.markDirty()
    expect(ctrl.dirty).toBe(true)
  })

  it("submit validates JSON for ES engine and shows warning", async () => {
    const ctrl = application.getControllerForElementAndIdentifier(
      document.querySelector('[data-controller="settings-panel"]'),
      "settings-panel",
    )
    // Switch to ES engine
    ctrl.searchEngineValue = "es"
    ctrl.queryParamsInputTarget.value = "not valid json"

    await ctrl.submit()

    expect(ctrl.warningTarget.classList.contains("d-none")).toBe(false)
    expect(ctrl.warningTarget.textContent).toContain("valid JSON")
  })

  it("submit POSTs to tries API and navigates on success", async () => {
    const ctrl = application.getControllerForElementAndIdentifier(
      document.querySelector('[data-controller="settings-panel"]'),
      "settings-panel",
    )

    const mockResponse = { try_number: 4 }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    })

    // Mock location to prevent actual navigation
    const originalLocation = window.location
    delete window.location
    window.location = { href: "" }

    await ctrl.submit()

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("api/cases/42/tries"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("query_params"),
      }),
    )
    expect(window.location.href).toContain("/case/42/try/4")

    window.location = originalLocation
  })

  it("toggleSection hides/shows the section body", () => {
    const ctrl = application.getControllerForElementAndIdentifier(
      document.querySelector('[data-controller="settings-panel"]'),
      "settings-panel",
    )

    // Create a mock section
    const header = document.createElement("div")
    header.innerHTML = '<span class="bi bi-dash-lg"></span>'
    const body = document.createElement("div")
    header.after = () => {} // noop
    // Append to DOM so nextElementSibling works
    const wrapper = document.createElement("div")
    wrapper.appendChild(header)
    wrapper.appendChild(body)

    ctrl.toggleSection({ currentTarget: header })

    expect(body.classList.contains("d-none")).toBe(true)
    expect(header.querySelector(".bi").classList.contains("bi-plus-lg")).toBe(true)
  })

  // ── Slice 1: Curator Variables ──────────────────────────────────

  it("extracts curator variables from query params", () => {
    const ctrl = application.getControllerForElementAndIdentifier(
      document.querySelector('[data-controller="settings-panel"]'),
      "settings-panel",
    )
    // Set query params with curator vars
    ctrl.queryParamsInputTarget.value = "q=##boost##&f=##filter##"
    ctrl.extractCuratorVars()

    const inputs = ctrl.curatorVarsContainerTarget.querySelectorAll("[data-curator-var]")
    expect(inputs.length).toBe(2)
    expect(inputs[0].dataset.curatorVar).toBe("boost")
    expect(inputs[1].dataset.curatorVar).toBe("filter")
  })

  it("filters out magic variables ($query, $keyword1)", () => {
    const ctrl = application.getControllerForElementAndIdentifier(
      document.querySelector('[data-controller="settings-panel"]'),
      "settings-panel",
    )

    const names = ctrl._extractVarNames("q=##$query##&b=##boost##&k=##$keyword1##")
    expect(names).toEqual(["boost"])
  })

  it("shows help text when no curator vars exist", () => {
    const ctrl = application.getControllerForElementAndIdentifier(
      document.querySelector('[data-controller="settings-panel"]'),
      "settings-panel",
    )
    ctrl.queryParamsInputTarget.value = "q=simple query"
    ctrl.extractCuratorVars()

    expect(ctrl.curatorVarsHelpTarget.classList.contains("d-none")).toBe(false)
  })

  // ── Slice 3: Try Management ─────────────────────────────────────

  it("toggleTryActions reveals action buttons", () => {
    const ctrl = application.getControllerForElementAndIdentifier(
      document.querySelector('[data-controller="settings-panel"]'),
      "settings-panel",
    )
    const toggleBtn = document.querySelector(".try-actions-toggle")
    ctrl.toggleTryActions({ currentTarget: toggleBtn, preventDefault: () => {}, stopPropagation: () => {} })

    const actions = document.querySelector(".try-actions")
    expect(actions.classList.contains("d-none")).toBe(false)
  })

  it("deleteTry prevents deleting last try", async () => {
    const ctrl = application.getControllerForElementAndIdentifier(
      document.querySelector('[data-controller="settings-panel"]'),
      "settings-panel",
    )
    // Only 1 try in DOM, so delete should be blocked
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {})
    const deleteBtn = document.querySelector('[data-action="click->settings-panel#deleteTry"]')
    await ctrl.deleteTry({ currentTarget: deleteBtn, stopPropagation: () => {} })

    expect(alertSpy).toHaveBeenCalledWith("Cannot delete the last try.")
    alertSpy.mockRestore()
  })

  // ── Slice 4: Search Endpoint Picker ─────────────────────────────

  it("switchTab to settings triggers endpoint fetch", () => {
    const ctrl = application.getControllerForElementAndIdentifier(
      document.querySelector('[data-controller="settings-panel"]'),
      "settings-panel",
    )

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    })

    const settingsTab = ctrl.tabTargets.find((t) => t.dataset.tab === "settings")
    ctrl.switchTab({ currentTarget: settingsTab })

    expect(ctrl.endpointsLoaded).toBe(true)
  })

  // ── Slice 6: Query Param Validation ─────────────────────────────

  it("warns about deftype typo for Solr", () => {
    const ctrl = application.getControllerForElementAndIdentifier(
      document.querySelector('[data-controller="settings-panel"]'),
      "settings-panel",
    )
    ctrl.queryParamsInputTarget.value = "deftype=edismax"
    ctrl._validateQueryParams()

    expect(ctrl.validationWarningsTarget.innerHTML).toContain("defType")
  })

  it("shows submit button on tuning knobs tab", () => {
    const ctrl = application.getControllerForElementAndIdentifier(
      document.querySelector('[data-controller="settings-panel"]'),
      "settings-panel",
    )
    const tuningTab = ctrl.tabTargets.find((t) => t.dataset.tab === "tuning")
    ctrl.switchTab({ currentTarget: tuningTab })

    expect(ctrl.submitAreaTarget.classList.contains("d-none")).toBe(false)
  })

  it("hides submit button on annotations tab", () => {
    const ctrl = application.getControllerForElementAndIdentifier(
      document.querySelector('[data-controller="settings-panel"]'),
      "settings-panel",
    )

    // Mock fetch for annotations lazy-load
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ annotations: [] }),
    })

    const annotationsTab = ctrl.tabTargets.find((t) => t.dataset.tab === "annotations")
    ctrl.switchTab({ currentTarget: annotationsTab })

    expect(ctrl.submitAreaTarget.classList.contains("d-none")).toBe(true)
  })

  it("submit includes curator_vars in payload", async () => {
    const ctrl = application.getControllerForElementAndIdentifier(
      document.querySelector('[data-controller="settings-panel"]'),
      "settings-panel",
    )

    // Add a curator var
    ctrl.queryParamsInputTarget.value = "q=##boost##"
    ctrl.extractCuratorVars()
    const varInput = ctrl.curatorVarsContainerTarget.querySelector("[data-curator-var]")
    varInput.value = "3.5"

    const mockResponse = { try_number: 5 }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    })

    const originalLocation = window.location
    delete window.location
    window.location = { href: "" }

    await ctrl.submit()

    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body.curator_vars).toEqual({ boost: 3.5 })

    window.location = originalLocation
  })
})
