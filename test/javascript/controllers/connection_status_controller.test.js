import { beforeEach, describe, expect, it, vi } from "vitest"
import { apiFetch } from "api/fetch"
import ConnectionStatusController from "controllers/connection_status_controller"

vi.mock("api/fetch", () => ({
  apiFetch: vi.fn()
}))

function buildController() {
  const controller = Object.create(ConnectionStatusController.prototype)
  controller.urlValue = "/connections/2/status"
  controller.buttonTarget = document.createElement("button")
  return controller
}

function respond(body, { ok = true, status = 200 } = {}) {
  apiFetch.mockResolvedValue({ ok, status, json: () => Promise.resolve(body) })
}

describe("ConnectionStatusController", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("asks for this connection's own status", async () => {
    respond({ status: "ok", message: "Connected.", elapsed_ms: 12 })
    const controller = buildController()

    await controller.check()

    expect(apiFetch).toHaveBeenCalledWith("/connections/2/status", {
      headers: { Accept: "application/json" }
    })
  })

  it("shows a green plug and the timing when the service answers", async () => {
    respond({
      status: "ok",
      message: "Connected: api/tags answered with HTTP 200.",
      elapsed_ms: 12
    })
    const controller = buildController()

    await controller.check()

    const button = controller.buttonTarget
    expect(button.dataset.state).toBe("up")
    expect(button.classList.contains("text-success")).toBe(true)
    expect(button.classList.contains("text-danger")).toBe(false)
    expect(button.title).toBe("Connected: api/tags answered with HTTP 200. (12 ms)")
  })

  it("shows a green plug for a service that answers but can't confirm the key", async () => {
    respond({ status: "reachable", message: "The server answered.", elapsed_ms: 40 })
    const controller = buildController()

    await controller.check()

    expect(controller.buttonTarget.dataset.state).toBe("up")
  })

  it("shows a red plug when the credentials are rejected", async () => {
    respond({
      status: "rejected",
      message: "OpenAI rejected the credentials (HTTP 401).",
      elapsed_ms: 80
    })
    const controller = buildController()

    await controller.check()

    const button = controller.buttonTarget
    expect(button.dataset.state).toBe("down")
    expect(button.classList.contains("text-danger")).toBe(true)
    expect(button.classList.contains("text-success")).toBe(false)
  })

  it("shows a red plug when the service can't be reached, which has no timing", async () => {
    respond({ status: "unreachable", message: "Could not reach http://x.", elapsed_ms: null })
    const controller = buildController()

    await controller.check()

    expect(controller.buttonTarget.dataset.state).toBe("down")
    expect(controller.buttonTarget.title).toBe("Could not reach http://x.")
  })

  it("shows a red plug with the server's error when the request itself fails", async () => {
    respond({ error: "Connection not found" }, { ok: false, status: 404 })
    const controller = buildController()

    await controller.check()

    expect(controller.buttonTarget.dataset.state).toBe("down")
    expect(controller.buttonTarget.title).toBe("Connection not found")
  })

  it("shows a red plug when the request throws", async () => {
    apiFetch.mockRejectedValue(new Error("Network down"))
    const controller = buildController()

    await controller.check()

    expect(controller.buttonTarget.dataset.state).toBe("down")
    expect(controller.buttonTarget.title).toBe("Network down")
  })

  it("is grey while it asks, and goes back to grey when asked again", async () => {
    respond({ status: "rejected", message: "no", elapsed_ms: 1 })
    const controller = buildController()
    await controller.check()

    let resolveFetch
    apiFetch.mockReturnValue(new Promise((resolve) => (resolveFetch = resolve)))
    const pending = controller.check()

    expect(controller.buttonTarget.dataset.state).toBe("checking")
    expect(controller.buttonTarget.classList.contains("text-muted")).toBe(true)
    expect(controller.buttonTarget.classList.contains("text-danger")).toBe(false)

    resolveFetch({
      ok: true,
      json: () => Promise.resolve({ status: "ok", message: "yes", elapsed_ms: 1 })
    })
    await pending
    expect(controller.buttonTarget.dataset.state).toBe("up")
  })
})
