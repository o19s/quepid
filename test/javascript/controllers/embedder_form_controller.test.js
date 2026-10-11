import { beforeEach, describe, expect, it, vi } from "vitest"
import { apiFetch } from "api/fetch"
import EmbedderFormController from "controllers/embedder_form_controller"

vi.mock("api/fetch", () => ({
  apiFetch: vi.fn()
}))

const PRESETS = {
  openai: {
    label: "OpenAI",
    service_url: "https://api.openai.com",
    model: "text-embedding-3-small",
    help: "<strong>OpenAI</strong>",
    supports_dimensions: true,
    allowed_dimensions: [],
    supports_instructions: false,
    uses_key: true,
    requires_key: true
  },
  voyage: {
    label: "Voyage AI",
    service_url: "https://api.voyageai.com",
    model: "voyage-3.5",
    help: "<strong>Voyage</strong>",
    supports_dimensions: true,
    allowed_dimensions: [256, 512, 1024, 2048],
    supports_instructions: false,
    uses_key: true
  },
  ollama: {
    label: "Ollama",
    service_url: "http://ollama:11434",
    model: "qwen3-embedding:0.6b",
    help: "<strong>Ollama</strong>",
    supports_dimensions: false,
    allowed_dimensions: [],
    supports_instructions: true,
    uses_key: false
  }
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

function buildController({ provider = "openai", truncation = "none" } = {}) {
  const controller = Object.create(EmbedderFormController.prototype)
  controller.presetsValue = PRESETS
  controller.testUrlValue = "embedders/new/test"
  controller.providerTarget = select(Object.keys(PRESETS), provider)
  controller.serviceUrlTarget = document.createElement("input")
  controller.modelTarget = document.createElement("input")
  controller.apiKeyRowTarget = document.createElement("div")
  controller.hasApiKeyHintTarget = true
  controller.apiKeyHintTarget = document.createElement("div")
  controller.truncationTarget = select(["none", "native", "client"], truncation)
  controller.truncationHintTarget = document.createElement("div")
  controller.dimensionsRowTarget = document.createElement("div")
  controller.dimensionsTarget = document.createElement("input")
  controller.dimensionsHintTarget = document.createElement("div")
  controller.instructionFieldsTarget = document.createElement("div")
  controller.helpTarget = document.createElement("div")
  controller.testTextTarget = document.createElement("input")
  controller.testButtonTarget = document.createElement("button")
  controller.testResultTarget = document.createElement("div")
  return controller
}

describe("EmbedderFormController", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows only the fields the provider can use", () => {
    const controller = buildController({ provider: "ollama" })

    controller.refresh()

    expect(controller.apiKeyRowTarget.hidden).toBe(true)
    expect(controller.instructionFieldsTarget.hidden).toBe(false)
    expect(controller.truncationTarget.querySelector("option[value='native']").disabled).toBe(true)
    expect(controller.dimensionsRowTarget.hidden).toBe(true)
    expect(controller.helpTarget.innerHTML).toContain("Ollama")
  })

  it("says whether the provider needs a key", () => {
    const controller = buildController({ provider: "openai" })

    controller.refresh()
    expect(controller.apiKeyHintTarget.textContent).toBe("Required for OpenAI.")

    controller.providerTarget.value = "ollama"
    controller.refresh()
    expect(controller.apiKeyHintTarget.textContent).toBe("Optional.")
  })

  it("lists the allowed sizes for native truncation", () => {
    const controller = buildController({ provider: "voyage", truncation: "native" })

    controller.refresh()

    expect(controller.dimensionsRowTarget.hidden).toBe(false)
    expect(controller.dimensionsHintTarget.textContent).toBe("Voyage AI accepts 256, 512, 1024, 2048.")
  })

  it("changing provider fills in its defaults and drops native truncation it can't do", () => {
    const controller = buildController({ provider: "openai", truncation: "native" })
    controller.serviceUrlTarget.value = "https://api.openai.com"
    controller.providerTarget.value = "ollama"

    controller.changeProvider()

    expect(controller.serviceUrlTarget.value).toBe("http://ollama:11434")
    expect(controller.modelTarget.value).toBe("qwen3-embedding:0.6b")
    expect(controller.truncationTarget.value).toBe("none")
  })

  it("test posts the form as a POST and shows the vector size", async () => {
    const controller = buildController()
    const form = document.createElement("form")
    form.innerHTML = '<input name="_method" value="patch"><input name="embedder[model]" value="m">'
    form.appendChild((controller.element = document.createElement("div")))
    controller.testTextTarget.value = "star wars"
    apiFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ input: "star wars", dimensions: 3, preview: [0.1, 0.2, 0.3], elapsed_ms: 12 })
    })

    await controller.test({ preventDefault: () => {} })

    const [url, init] = apiFetch.mock.calls[0]
    expect(url).toBe("embedders/new/test")
    expect(init.method).toBe("POST")
    expect(init.body.has("_method")).toBe(false)
    expect(init.body.get("text")).toBe("star wars")
    expect(controller.testResultTarget.textContent).toContain("3 dimensions")
  })

  it("test shows the server's error", async () => {
    const controller = buildController()
    const form = document.createElement("form")
    form.appendChild((controller.element = document.createElement("div")))
    apiFetch.mockResolvedValue({ ok: false, status: 502, json: () => Promise.resolve({ error: "Ollama API error: 404" }) })

    await controller.test({ preventDefault: () => {} })

    expect(controller.testResultTarget.querySelector(".alert-danger").textContent).toBe("Ollama API error: 404")
  })
})
