import { beforeEach, describe, expect, it, vi } from "vitest"
import { apiFetch } from "api/fetch"
import EmbedderFormController from "controllers/embedder_form_controller"

vi.mock("api/fetch", () => ({
  apiFetch: vi.fn()
}))

const PRESETS = {
  openai: {
    label: "OpenAI",
    model: "text-embedding-3-small",
    supports_dimensions: true,
    allowed_dimensions: [],
    supports_instructions: false
  },
  voyage: {
    label: "Voyage AI",
    model: "voyage-3.5",
    supports_dimensions: true,
    allowed_dimensions: [256, 512, 1024, 2048],
    supports_instructions: false
  },
  ollama: {
    label: "Ollama",
    model: "qwen3-embedding:0.6b",
    supports_dimensions: false,
    allowed_dimensions: [],
    supports_instructions: true
  }
}

// A prompt, a Voyage connection and two Ollama ones, each provider being inferred from its connection.
const CONNECTIONS = [
  ["7", "voyage", "https://api.voyageai.com", "Voyage AI"],
  ["8", "ollama", "http://ollama:11434", "Ollama"],
  ["9", "ollama", "http://gpu-box:11434", "Ollama"]
]

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

function connectionDropdown() {
  const dropdown = document.createElement("select")
  const prompt = document.createElement("option")
  prompt.value = ""
  dropdown.append(prompt)
  CONNECTIONS.forEach(([id, provider, url, label]) => {
    const option = document.createElement("option")
    option.value = id
    option.dataset.provider = provider
    option.dataset.url = url
    option.dataset.providerLabel = label
    dropdown.append(option)
  })
  return dropdown
}

function buildController({ provider = "", selectedConnection = "", truncation = "none" } = {}) {
  const controller = Object.create(EmbedderFormController.prototype)
  controller.presetsValue = PRESETS
  controller.checkUrlValue = "embedders/connection_check"
  controller.newConnectionUrlValue = "/connections/new"
  controller.providerTarget = document.createElement("input")
  controller.providerTarget.value = provider
  controller.modelTarget = document.createElement("input")
  controller.hasConnectionTarget = true
  controller.connectionTarget = connectionDropdown()
  controller.connectionTarget.value = selectedConnection
  controller.hasConnectionInfoTarget = true
  controller.connectionInfoTarget = document.createElement("div")
  controller.hasNoConnectionsTarget = true
  controller.noConnectionsTarget = document.createElement("div")
  controller.hasNewConnectionLinkTarget = true
  controller.newConnectionLinkTarget = document.createElement("a")
  controller.truncationTarget = select(["none", "native", "client"], truncation)
  controller.truncationHintTarget = document.createElement("div")
  controller.dimensionsRowTarget = document.createElement("div")
  controller.dimensionsTarget = document.createElement("input")
  controller.dimensionsHintTarget = document.createElement("div")
  controller.instructionFieldsTarget = document.createElement("div")
  controller.hasNoInstructionsTarget = true
  controller.noInstructionsTarget = document.createElement("div")
  controller.helpTargets = Object.keys(PRESETS).map((key) => {
    const help = document.createElement("div")
    help.dataset.provider = key
    return help
  })
  controller.checkTextTarget = document.createElement("input")
  controller.checkButtonTarget = document.createElement("button")
  controller.hasCheckHintTarget = true
  controller.checkHintTarget = document.createElement("div")
  controller.checkResultTarget = document.createElement("div")
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

  describe("the connection", () => {
    it("lists connections for all embedding providers", () => {
      const controller = buildController()
      controller.refresh()

      expect(offered(controller)).toEqual(["7", "8", "9"])
    })

    it("infers the provider and its model defaults from the selected connection", () => {
      const controller = buildController()
      controller.refresh()
      controller.connectionTarget.value = "8"
      controller.changeConnection()

      expect(controller.providerTarget.value).toBe("ollama")
      expect(controller.modelTarget.value).toBe("qwen3-embedding:0.6b")

      controller.connectionTarget.value = "7"
      controller.changeConnection()

      expect(controller.providerTarget.value).toBe("voyage")
      expect(controller.modelTarget.value).toBe("voyage-3.5")
      expect(offered(controller)).toEqual(["7", "8", "9"])
    })

    it("says where the URL, key and timeout come from once one is chosen", () => {
      const controller = buildController({ provider: "ollama" })
      controller.refresh()
      expect(controller.connectionInfoTarget.hidden).toBe(true)

      controller.connectionTarget.value = "9"
      controller.changeConnection()

      expect(controller.connectionInfoTarget.hidden).toBe(false)
      expect(controller.connectionInfoTarget.textContent).toContain(
        "Ollama at http://gpu-box:11434"
      )
      expect(controller.connectionInfoTarget.textContent).toContain("URL, key and timeout")
    })

    it("offers to create a connection when there is none to pick", () => {
      const controller = buildController()
      const prompt = controller.connectionTarget.options[0].cloneNode(true)
      controller.connectionTarget.replaceChildren(prompt)

      controller.refresh()

      expect(controller.noConnectionsTarget.hidden).toBe(false)
      expect(controller.newConnectionLinkTarget.textContent).toBe("Create a connection")
      expect(controller.newConnectionLinkTarget.getAttribute("href")).toBe("/connections/new")
    })

    it("hides the create connection offer when a connection is available", () => {
      const controller = buildController()

      controller.refresh()
      expect(controller.noConnectionsTarget.hidden).toBe(true)

      controller.connectionTarget.replaceChildren(
        controller.connectionTarget.options[0].cloneNode(true)
      )
      controller.refresh()
      expect(controller.noConnectionsTarget.hidden).toBe(false)
    })
  })

  describe("the Check connection button", () => {
    it("is disabled, with a hint to add a connection, until one is chosen", () => {
      const controller = buildController()

      controller.refresh()

      expect(controller.checkButtonTarget.disabled).toBe(true)
      expect(controller.checkHintTarget.hidden).toBe(false)
    })

    it("is enabled once a connection is chosen", () => {
      const controller = buildController()
      controller.refresh()

      controller.connectionTarget.value = "8"
      controller.changeConnection()

      expect(controller.checkButtonTarget.disabled).toBe(false)
      expect(controller.checkHintTarget.hidden).toBe(true)
    })

    it("is disabled again when the connection is cleared or no longer fits the provider", () => {
      const controller = buildController()
      controller.refresh()
      controller.connectionTarget.value = "8"
      controller.changeConnection()

      controller.connectionTarget.value = ""
      controller.changeConnection()
      expect(controller.checkButtonTarget.disabled).toBe(true)
      expect(controller.checkHintTarget.hidden).toBe(false)
    })
  })

  it("shows only the fields the provider can use", () => {
    const controller = buildController({ provider: "ollama", selectedConnection: "8" })

    controller.refresh()

    expect(controller.instructionFieldsTarget.hidden).toBe(false)
    expect(controller.truncationTarget.querySelector("option[value='native']").disabled).toBe(true)
    expect(controller.dimensionsRowTarget.hidden).toBe(true)
    expect(
      controller.helpTargets.filter((help) => !help.hidden).map((help) => help.dataset.provider)
    ).toEqual(["ollama"])
  })

  it("says so in the Instructions tab when the provider takes no instruction", () => {
    const controller = buildController({ provider: "openai", selectedConnection: "7" })

    controller.refresh()
    expect(controller.instructionFieldsTarget.hidden).toBe(true)
    expect(controller.noInstructionsTarget.hidden).toBe(false)

    controller.connectionTarget.value = "8"
    controller.changeConnection()
    expect(controller.instructionFieldsTarget.hidden).toBe(false)
    expect(controller.noInstructionsTarget.hidden).toBe(true)
  })

  it("lists the allowed sizes for native truncation", () => {
    const controller = buildController({ provider: "voyage", truncation: "native" })

    controller.refresh()

    expect(controller.dimensionsRowTarget.hidden).toBe(false)
    expect(controller.dimensionsHintTarget.textContent).toBe(
      "Voyage AI accepts 256, 512, 1024, 2048."
    )
  })

  it("changing connection provider fills in its default model and drops unsupported native truncation", () => {
    const controller = buildController({
      provider: "openai",
      selectedConnection: "7",
      truncation: "native"
    })
    controller.connectionTarget.value = "8"

    controller.changeConnection()

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
