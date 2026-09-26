import { afterEach, describe, expect, it, vi } from "vitest"
import { waitForAngularServices } from "utils/core_angular_adapter"

describe("core Angular adapter", () => {
  afterEach(() => {
    delete window.angular
    document.body.innerHTML = ""
    vi.restoreAllMocks()
  })

  it("resolves the requested services from the core injector", async () => {
    document.body.setAttribute("ng-app", "QuepidApp")
    const services = { settingsSvc: { name: "settings" }, caseSvc: { name: "case" } }
    const injector = { get: vi.fn(name => services[name]) }
    window.angular = { element: vi.fn(() => ({ injector: () => injector })) }

    await expect(waitForAngularServices(["settingsSvc", "caseSvc"])).resolves.toEqual(services)
    expect(injector.get).toHaveBeenCalledWith("settingsSvc")
    expect(injector.get).toHaveBeenCalledWith("caseSvc")
  })

  it("rejects when Angular never becomes available", async () => {
    await expect(waitForAngularServices(["settingsSvc"], { intervalMs: 0, maxAttempts: 1 }))
      .rejects.toThrow("Unable to load the Angular core services.")
  })
})
