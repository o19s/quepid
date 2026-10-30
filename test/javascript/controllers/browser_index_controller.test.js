import { buildControllerFixture } from "../support/controller_fixture"
import { afterEach, expect, it, vi } from "vitest"
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
      progressUrl: "/progress?search_endpoint_id=2",
      batchSize: 2,
      ...values
    }
  })
  return { controller, message, bar }
}

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
  await controller.createIndex()
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
  await expect(controller.createIndex()).rejects.toThrow(/wands is already there/)
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
  await controller.load(3)
  const bulks = calls.filter(([url]) => url.endsWith("/_bulk"))
  expect(bulks).toHaveLength(2)
  expect(bulks[0][1].body.split("\n")[0]).toBe('{"index":{"_index":"wands","_id":"1"}}')
  expect(controller.sent).toBe(3)
  expect(bar.style.width).toBe("100%")
  const reports = calls.filter(([url]) => url.startsWith("/progress"))
  expect(reports.at(-1)[1].body.get("status")).toBe("done")
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
  await expect(controller.load(1)).rejects.toThrow(
    /1 of 1 documents were refused.*strict_dynamic_mapping_exception: no/
  )
})

it("leaves the form to Quepid when there is no probe", async () => {
  const { controller } = build({ probe: {} })
  const event = { preventDefault: vi.fn() }
  await controller.submit(event)
  expect(event.preventDefault).not.toHaveBeenCalled()
})
