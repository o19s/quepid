import { buildControllerFixture } from "../support/controller_fixture"
import { afterEach, expect, it, vi } from "vitest"
import { patchJson, postJson } from "api/json"
vi.mock("api/json", () => ({ postJson: vi.fn(), patchJson: vi.fn() }))
vi.mock("utils/confirm_dialog", () => ({ confirmDialog: vi.fn().mockResolvedValue(true) }))
import BrowserIndexController from "controllers/browser_index_controller"

const probe = {
  origin: "http://localhost:9200",
  engine: "es",
  path: "/movies/_search",
  headers: { "X-Key": "1" }
}

function build(values = {}) {
  const form = document.createElement("form")
  form.action = "http://quepid.test/dataset_cases/1/index"
  for (const [name, value] of Object.entries({
    index_name: "wands",
    definition: '{"settings":{}}',
    authenticity_token: "t"
  })) {
    const input = document.createElement("input")
    input.name = name
    input.value = value
    form.append(input)
  }
  const message = document.createElement("div")
  const bar = document.createElement("div")
  const progress = document.createElement("div")
  const controller = buildControllerFixture(BrowserIndexController, {
    element: form,
    targets: { message, bar, progress },
    values: {
      probe,
      streamUrl: "/stream",
      progressUrl: "/progress",
      endpointId: 2,
      batchSize: 2,
      ...values
    }
  })
  return { controller, message, bar }
}

const form = { index_name: "wands", definition: '{"settings":{}}' }

function ndjson(lines) {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(stream) {
      stream.enqueue(encoder.encode(lines.join("\n") + "\n"))
      stream.close()
    }
  })
}

afterEach(() => vi.restoreAllMocks())

it("creates the index at the service itself, with the endpoint's headers", async () => {
  const { controller } = build()
  globalThis.fetch = vi.fn().mockResolvedValue({ ok: true })
  await controller.createIndex(form)
  const [url, options] = globalThis.fetch.mock.calls[0]
  expect(url).toBe("http://localhost:9200/wands")
  expect(options.method).toBe("PUT")
  expect(options.headers["X-Key"]).toBe("1")
  expect(options.body).toBe('{"settings":{}}')
})

it("says the name is taken when the service refuses to create it", async () => {
  const { controller } = build()
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 400,
    text: async () => '{"error":{"type":"resource_already_exists_exception"}}'
  })
  await expect(controller.createIndex(form)).rejects.toThrow(/wands is already there/)
})

it("sends the documents to the bulk API in batches, and reports the progress", async () => {
  const { controller, bar } = build()
  const calls = []
  globalThis.fetch = vi.fn(async (url, options = {}) => {
    calls.push([String(url), options])
    if ("/stream" === url)
      return { ok: true, body: ndjson(['{"id":"1"}', '{"id":"2"}', '{"id":"3"}']) }
    if (String(url).endsWith("/_bulk"))
      return {
        ok: true,
        json: async () => ({
          items: JSON.parse(
            `[${options.body
              .split("\n")
              .filter((_, i) => i % 2 === 0 && _)
              .map(() => '{"index":{"status":201}}')
              .join(",")}]`
          )
        })
      }
    return { ok: true }
  })
  await controller.load(3, "wands")
  const bulks = calls.filter(([url]) => url.endsWith("/_bulk"))
  expect(bulks).toHaveLength(2)
  expect(bulks[0][1].body.split("\n")[0]).toBe('{"index":{"_index":"wands","_id":"1"}}')
  expect(controller.sent).toBe(3)
  expect(bar.style.width).toBe("100%")
  expect(patchJson).toHaveBeenLastCalledWith(
    "/progress",
    expect.objectContaining({ search_endpoint_id: 2, status: "done", documents_indexed: 3 })
  )
})

it("fails the loading when the service refuses documents", async () => {
  const { controller } = build()
  globalThis.fetch = vi.fn(async (url) => {
    if ("/stream" === url) return { ok: true, body: ndjson(['{"id":"1"}']) }
    if (String(url).endsWith("/_bulk"))
      return {
        ok: true,
        json: async () => ({
          items: [
            {
              index: {
                status: 400,
                error: { type: "strict_dynamic_mapping_exception", reason: "no" }
              }
            }
          ]
        })
      }
    return { ok: true }
  })
  await expect(controller.load(1, "wands")).rejects.toThrow(
    /1 of 1 documents were refused.*strict_dynamic_mapping_exception: no/
  )
})

it("leaves the form to Quepid when there is no probe", async () => {
  const { controller } = build({ probe: {} })
  const event = { preventDefault: vi.fn() }
  await controller.submit(event)
  expect(event.preventDefault).not.toHaveBeenCalled()
})

function submitFixture(overrides = {}) {
  const built = build(overrides)
  const button = document.createElement("button")
  built.controller.element.append(button)
  built.controller.confirmValue = "Create it?"
  built.controller.hasProbeValue = true
  return { ...built, button }
}

it("sends nothing when the user does not confirm", async () => {
  const { confirmDialog } = await import("utils/confirm_dialog")
  confirmDialog.mockResolvedValueOnce(false)
  const { controller } = submitFixture()
  globalThis.fetch = vi.fn()
  const event = { preventDefault: vi.fn() }
  await controller.submit(event)
  expect(event.preventDefault).toHaveBeenCalled()
  expect(globalThis.fetch).not.toHaveBeenCalled()
})

it("creates the index, tells Quepid, loads the documents and goes to the Dataset Cases page", async () => {
  const { controller } = submitFixture()
  const urls = []
  postJson.mockResolvedValue({ redirect: "/dataset_cases", load: true, total: 1 })
  globalThis.fetch = vi.fn(async (url) => {
    urls.push(String(url))
    if ("/stream" === url) return { ok: true, body: ndjson(['{"id":"1"}']) }
    if (String(url).endsWith("/_bulk"))
      return { ok: true, json: async () => ({ items: [{ index: { status: 201 } }] }) }
    return { ok: true }
  })
  window.Turbo = { visit: vi.fn() }
  await controller.submit({ preventDefault: vi.fn() })
  expect(urls[0]).toBe("http://localhost:9200/wands")
  expect(postJson).toHaveBeenCalledWith(
    "http://quepid.test/dataset_cases/1/index",
    expect.objectContaining({ index_name: "wands", applied: true })
  )
  expect(urls).toContain("http://localhost:9200/_bulk")
  expect(window.Turbo.visit).toHaveBeenCalledWith("/dataset_cases")
  delete window.Turbo
})

it("keeps loading into the index it was asked for, with the form locked, even if the name is edited on the way", async () => {
  const { controller, button } = submitFixture()
  const name = controller.element.querySelector("[name=index_name]")
  name.value = " wands "
  const indexes = []
  postJson.mockImplementation(async () => {
    name.value = "other"
    return { redirect: "/dataset_cases", load: true, total: 1 }
  })
  globalThis.fetch = vi.fn(async (url, options = {}) => {
    if ("/stream" === url) {
      expect(name.disabled).toBe(true)
      expect(button.disabled).toBe(true)
      return { ok: true, body: ndjson(['{"id":"1"}']) }
    }
    if (String(url).endsWith("/_bulk")) {
      indexes.push(JSON.parse(options.body.split("\n")[0]).index._index)
      return { ok: true, json: async () => ({ items: [{ index: { status: 201 } }] }) }
    }
    if (String(url).endsWith("/_refresh")) indexes.push(String(url))
    return { ok: true }
  })
  window.Turbo = { visit: vi.fn() }
  await controller.submit({ preventDefault: vi.fn() })
  expect(indexes).toEqual(["wands", "http://localhost:9200/wands/_refresh"])
  delete window.Turbo
})

it("shows Quepid's reason, and keeps the loading from starting, when Quepid refuses to set the case up", async () => {
  const { HttpError } = await import("api/http_error")
  const { controller, message, button } = submitFixture()
  postJson.mockRejectedValue(
    new HttpError({ status: 422, statusText: "x", data: { error: "That name is not safe." } })
  )
  globalThis.fetch = vi.fn().mockResolvedValue({ ok: true })
  await controller.submit({ preventDefault: vi.fn() })
  expect(message.textContent).toBe("That name is not safe.")
  expect(button.disabled).toBe(false)
  expect(controller.element.querySelector("[name=index_name]").disabled).toBe(false)
})

it("shows why it stopped and gives the button back when the service refuses the index", async () => {
  const { controller, message, button } = submitFixture()
  globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => "bad" })
  await controller.submit({ preventDefault: vi.fn() })
  expect(message.textContent).toMatch(/answered 400/)
  expect(button.disabled).toBe(false)
})

it("tells Quepid the loading failed when the page is closed in the middle of it", () => {
  const { controller } = build()
  controller.running = true
  controller.loading = true
  controller.sent = 120
  const beacon = vi.fn()
  Object.defineProperty(navigator, "sendBeacon", { value: beacon, configurable: true })
  controller.interrupted()
  const [url, data] = beacon.mock.calls[0]
  expect(url).toBe("/progress")
  expect(data.get("_method")).toBe("patch")
  expect(data.get("status")).toBe("failed")
  expect(data.get("documents_indexed")).toBe("120")
  expect(data.get("search_endpoint_id")).toBe("2")
})

it("says nothing when the page is closed and nothing was loading", () => {
  const { controller } = build()
  const beacon = vi.fn()
  Object.defineProperty(navigator, "sendBeacon", { value: beacon, configurable: true })
  controller.interrupted()
  expect(beacon).not.toHaveBeenCalled()
})

it("creates a Solr index through the schema, and loads it through the update handler", async () => {
  const solr = {
    origin: "http://solr:8983",
    engine: "solr",
    path: "/solr/shop/select",
    headers: {}
  }
  const { controller } = build({ probe: solr })
  const calls = []
  globalThis.fetch = vi.fn(async (url, options = {}) => {
    calls.push([String(url), options])
    return { ok: true }
  })
  controller.sent = 0
  controller.total = 2
  await controller.createIndex(form)
  expect(calls[0][0]).toBe("http://solr:8983/solr/shop/schema")
  await controller.sendBatch([{ id: "1" }, { id: "2" }], "wands")
  expect(calls[1][0]).toBe("http://solr:8983/solr/shop/update?commit=true")
  expect(JSON.parse(calls[1][1].body)).toEqual([{ id: "1" }, { id: "2" }])
  expect(controller.sent).toBe(2)
})

it("creates a Qdrant collection and its payload indexes", async () => {
  const qdrant = { origin: "http://qd:6333", engine: "qdrant", path: "", headers: {} }
  const { controller } = build({ probe: qdrant })
  const definition = JSON.stringify({
    collection: { vectors: {} },
    payload_indexes: [{ field_name: "brand" }]
  })
  const calls = []
  globalThis.fetch = vi.fn(async (url, options = {}) => {
    calls.push([options.method, String(url)])
    return { ok: true }
  })
  await controller.createIndex({ index_name: "wands", definition })
  expect(calls).toEqual([
    ["PUT", "http://qd:6333/collections/wands"],
    ["PUT", "http://qd:6333/collections/wands/index"]
  ])
})
