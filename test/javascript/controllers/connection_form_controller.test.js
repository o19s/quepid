import { describe, expect, it } from "vitest"
import ConnectionFormController from "controllers/connection_form_controller"

const PRESETS = {
  openai: { label: "OpenAI", base_url: "https://api.openai.com", auth_scheme: "bearer" },
  voyage: { label: "Voyage AI", base_url: "https://api.voyageai.com", auth_scheme: "bearer" }
}

function select(values, selected) {
  const element = document.createElement("select")
  values.forEach((value) => {
    const option = document.createElement("option")
    option.value = value
    element.appendChild(option)
  })
  element.value = selected
  return element
}

function buildController(service = "openai") {
  const controller = Object.create(ConnectionFormController.prototype)
  controller.presetsValue = PRESETS
  controller.hasNameTarget = true
  controller.nameTarget = document.createElement("input")
  controller.serviceTarget = select(Object.keys(PRESETS), service)
  controller.baseUrlTarget = document.createElement("input")
  controller.apiVersionRowTarget = document.createElement("div")
  controller.apiVersionTarget = document.createElement("input")
  controller.authSchemeTarget = select(["none", "bearer", "basic", "header"], "bearer")
  controller.authHeaderRowTarget = document.createElement("div")
  controller.authHeaderTarget = document.createElement("input")
  controller.secretRowTarget = document.createElement("div")
  controller.secretLabelTarget = document.createElement("label")
  controller.secretHintTarget = document.createElement("div")
  controller.helpTargets = []
  return controller
}

describe("ConnectionFormController", () => {
  it("shows the name a blank one will get, after the chosen service", () => {
    const controller = buildController("openai")

    controller.refresh()
    expect(controller.nameTarget.placeholder).toBe("OpenAI Connection")

    controller.serviceTarget.value = "voyage"
    controller.changeService()
    expect(controller.nameTarget.placeholder).toBe("Voyage AI Connection")
  })

  it("fills the service's URL when it changes", () => {
    const controller = buildController("openai")
    controller.serviceTarget.value = "voyage"

    controller.changeService()

    expect(controller.baseUrlTarget.value).toBe("https://api.voyageai.com")
  })
})
