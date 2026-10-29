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
    supports_dimensions: true,
    allowed_dimensions: [256, 512, 1024, 2048],
    supports_instructions: false,
    uses_key: true
  },
  ollama: {
    label: "Ollama",
    service_url: "http://ollama:11434",
    model: "qwen3-embedding:0.6b",
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
  controller.checkUrlValue = "embedders/connection_check"
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
  controller.helpTargets = Object.keys(PRESETS).map((key) => {
    const help = document.createElement("div")
    help.dataset.provider = key
    return help
  })
  controller.checkTextTarget = document.createElement("input")
  controller.checkButtonTarget = document.createElement("button")
  controller.checkResultTarget = document.createElement("div")
  return controller
}

// A controller wired to a connection dropdown holding "none", a Voyage connection and two Ollama
// ones, so the dropdown can be narrowed by provider.
function buildConnectedController(options = {}) {
  const controller = buildController(options)
  const dropdown = document.createElement("select")
  const none = document.createElement("option")
  none.value = ""
  dropdown.append(none)
  ;[
    ["7", "voyage", "https://api.voyageai.com", "Voyage AI"],
    ["8", "ollama", "http://ollama:11434", "Ollama"],
    ["9", "ollama", "http://gpu-box:11434", "Ollama"]
  ].forEach(([id, service, url, label]) => {
    const option = document.createElement("option")
    option.value = id
    option.dataset.service = service
    option.dataset.url = url
    option.dataset.serviceLabel = label
    dropdown.append(option)
  })
  controller.hasConnectionTarget = true
  controller.connectionTarget = dropdown
  controller.hasConnectionInfoTarget = true
  controller.connectionInfoTarget = document.createElement("div")
  controller.serviceUrlRowTarget = document.createElement("div")
  controller.timeoutRowTarget = document.createElement("div")
  return controller
}

function offered(controller) {
  return [...controller.connectionTarget.options]
    .filter((option) => option.value && !option.disabled)
    .map((option) => option.value)
}

describe("EmbedderFormController", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("with a connection", () => {
    it("keeps the URL, key and timeout fields when no connection is chosen", () => {
      const controller = buildConnectedController({ provider: "ollama" })

      controller.refresh()

      expect(controller.serviceUrlRowTarget.hidden).toBe(false)
      expect(controller.timeoutRowTarget.hidden).toBe(false)
      expect(controller.apiKeyRowTarget.hidden).toBe(true) // Ollama takes no key
      expect(controller.connectionInfoTarget.hidden).toBe(true)
    })

    it("lists only the connections for the chosen provider", () => {
      const ollama = buildConnectedController({ provider: "ollama" })
      ollama.refresh()
      expect(offered(ollama)).toEqual(["8", "9"])

      const voyage = buildConnectedController({ provider: "voyage" })
      voyage.refresh()
      expect(offered(voyage)).toEqual(["7"])

      const openai = buildConnectedController({ provider: "openai" })
      openai.refresh()
      expect(offered(openai)).toEqual([])
    })

    it("narrows the list when the provider changes, and drops a connection that no longer fits", () => {
      const controller = buildConnectedController({ provider: "ollama" })
      controller.refresh()
      controller.connectionTarget.value = "8"
      controller.changeConnection()

      controller.providerTarget.value = "voyage"
      controller.changeProvider()

      expect(offered(controller)).toEqual(["7"])
      expect(controller.connectionTarget.value).toBe("")
      expect(controller.serviceUrlRowTarget.hidden).toBe(false)
    })

    it("hides what the connection owns and says where it comes from", () => {
      const controller = buildConnectedController({ provider: "ollama" })
      controller.refresh()
      controller.connectionTarget.value = "9"

      controller.changeConnection()

      expect(controller.serviceUrlRowTarget.hidden).toBe(true)
      expect(controller.timeoutRowTarget.hidden).toBe(true)
      expect(controller.apiKeyRowTarget.hidden).toBe(true)
      expect(controller.connectionInfoTarget.hidden).toBe(false)
      expect(controller.connectionInfoTarget.textContent).toContain(
        "Ollama at http://gpu-box:11434"
      )
    })

    it("hides the key field for a provider that takes one once a connection is chosen", () => {
      const controller = buildConnectedController({ provider: "voyage" })
      controller.refresh()
      expect(controller.apiKeyRowTarget.hidden).toBe(false)

      controller.connectionTarget.value = "7"
      controller.changeConnection()

      expect(controller.apiKeyRowTarget.hidden).toBe(true)
    })

    it("shows the fields again when the connection is cleared", () => {
      const controller = buildConnectedController({ provider: "voyage" })
      controller.refresh()
      controller.connectionTarget.value = "7"
      controller.changeConnection()

      controller.connectionTarget.value = ""
      controller.changeConnection()

      expect(controller.serviceUrlRowTarget.hidden).toBe(false)
      expect(controller.apiKeyRowTarget.hidden).toBe(false)
      expect(controller.connectionInfoTarget.hidden).toBe(true)
    })
  })

  it("shows only the fields the provider can use", () => {
    const controller = buildController({ provider: "ollama" })

    controller.refresh()

    expect(controller.apiKeyRowTarget.hidden).toBe(true)
    expect(controller.instructionFieldsTarget.hidden).toBe(false)
    expect(controller.truncationTarget.querySelector("option[value='native']").disabled).toBe(true)
    expect(controller.dimensionsRowTarget.hidden).toBe(true)
    expect(
      controller.helpTargets.filter((help) => !help.hidden).map((help) => help.dataset.provider)
    ).toEqual(["ollama"])
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
    expect(controller.dimensionsHintTarget.textContent).toBe(
      "Voyage AI accepts 256, 512, 1024, 2048."
    )
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

  it("check posts the form as a POST and shows the vector size", async () => {
    const controller = buildController()
    const form = document.createElement("form")
    form.innerHTML = '<input name="_method" value="patch"><input name="embedder[model]" value="m">'
    form.appendChild((controller.element = document.createElement("div")))
    controller.checkTextTarget.value = "star wars"
    apiFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          input: "star wars",
          dimensions: 3,
          preview: [0.1, 0.2, 0.3],
          elapsed_ms: 12
        })
    })

    await controller.check({ preventDefault: () => {} })

    const [url, init] = apiFetch.mock.calls[0]
    expect(url).toBe("embedders/connection_check")
    expect(init.method).toBe("POST")
    expect(init.body.has("_method")).toBe(false)
    expect(init.body.get("text")).toBe("star wars")
    expect(controller.checkResultTarget.textContent).toContain("3 dimensions")
  })

  it("check shows the server's error", async () => {
    const controller = buildController()
    const form = document.createElement("form")
    form.appendChild((controller.element = document.createElement("div")))
    apiFetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.resolve({ error: "Ollama API error: 404" })
    })

    await controller.check({ preventDefault: () => {} })

    expect(controller.checkResultTarget.querySelector(".alert-danger").textContent).toBe(
      "Ollama API error: 404"
    )
  })
})
