import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { Application } from "@hotwired/stimulus"
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
           data-settings-panel-search-engine-value="solr"
           data-settings-panel-query-params-value="q=#$query##"
           data-settings-panel-field-spec-value="title id"
           data-settings-panel-number-of-rows-value="10"
           data-settings-panel-escape-query-value="true"
           data-settings-panel-search-endpoint-id-value="5">

        <ul class="nav nav-tabs">
          <li class="tabBoxSelected" data-action="click->settings-panel#switchTab"
              data-settings-panel-target="tab" data-tab="query">Query</li>
          <li data-action="click->settings-panel#switchTab"
              data-settings-panel-target="tab" data-tab="settings">Settings</li>
          <li data-action="click->settings-panel#switchTab"
              data-settings-panel-target="tab" data-tab="history">History</li>
        </ul>

        <div data-settings-panel-target="tabContent" data-tab="query">
          <div class="alert d-none" data-settings-panel-target="warning"></div>
          <textarea data-settings-panel-target="queryParamsInput"
                    data-action="input->settings-panel#markDirty">q=#$query##</textarea>
        </div>
        <div class="d-none" data-settings-panel-target="tabContent" data-tab="settings">
          <input value="title id" data-settings-panel-target="fieldSpecInput"
                 data-action="input->settings-panel#markDirty" />
          <input type="number" value="10" data-settings-panel-target="numberOfRowsInput"
                 data-action="input->settings-panel#markDirty" />
          <input type="checkbox" checked data-settings-panel-target="escapeQueryInput"
                 data-action="change->settings-panel#markDirty" />
        </div>
        <div class="d-none" data-settings-panel-target="tabContent" data-tab="history">
          <ul data-settings-panel-target="tryHistory"></ul>
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
    expect(window.location.href).toContain("/case/42/try/4/new_ui")

    window.location = originalLocation
  })

  it("toggleSection hides/shows the section body", () => {
    const ctrl = application.getControllerForElementAndIdentifier(
      document.querySelector('[data-controller="settings-panel"]'),
      "settings-panel",
    )

    // Create a mock section
    const header = document.createElement("div")
    header.innerHTML = '<span class="glyphicon glyphicon-minus-sign"></span>'
    const body = document.createElement("div")
    header.after = () => {} // noop
    // Append to DOM so nextElementSibling works
    const wrapper = document.createElement("div")
    wrapper.appendChild(header)
    wrapper.appendChild(body)

    ctrl.toggleSection({ currentTarget: header })

    expect(body.classList.contains("d-none")).toBe(true)
    expect(header.querySelector(".glyphicon").classList.contains("glyphicon-plus-sign")).toBe(true)
  })
})
