import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import CoreBootstrapController from "controllers/core_bootstrap_controller"
import { resetCoreFlashForTest, setCoreFlashForTest } from "utils/core_test_overrides"
import { SearchError } from "utils/search_error"

describe("CoreBootstrapController", () => {
  beforeEach(() => {
    window.quepidStore = {
      diff: {
        reset: vi.fn(),
        disable: vi.fn()
      }
    }
    window.quepidSearch = {
      queryCapabilities: {
        resetQueryState: vi.fn(),
        resetQuery: vi.fn(),
        resetSearchPromise: vi.fn(),
        changeSettings: vi.fn().mockResolvedValue(undefined)
      },
      queryCommands: {
        searchAll: vi.fn().mockResolvedValue(undefined)
      },
      caseRuntime: {
        bootstrap: {
          core: {
            configuration: {
              setCommunalScorersOnly: vi.fn(),
              setQueryListSortable: vi.fn(),
              setCaseNo: vi.fn(),
              setTryNo: vi.fn()
            },
            user: { loadCurrent: vi.fn().mockResolvedValue({ id: 7 }) },
            case: {
              load: vi.fn().mockResolvedValue({ tries: [], lastTry: 1 }),
              select: vi.fn(),
              trackLastViewedAt: vi.fn(),
              fetchDropdownCases: vi.fn()
            },
            settings: {
              editable: vi.fn().mockReturnValue({ searchUrl: "http://search" }),
              setCaseTries: vi.fn(),
              setCurrentTry: vi.fn(),
              isTrySelected: vi.fn().mockReturnValue(true)
            },
            navigation: {
              currentCaseNo: vi.fn().mockReturnValue(1),
              currentTryNo: vi.fn().mockReturnValue(1),
              complete: vi.fn(),
              needToRedirectQuepidProtocol: vi.fn().mockReturnValue(false)
            }
          },
          docCache: { empty: vi.fn(), invalidate: vi.fn(), update: vi.fn().mockResolvedValue(undefined) }
        }
      }
    }
  })

  afterEach(() => {
    delete window.quepidStore
    delete window.quepidSearch
    delete window.quepidCoreBootstrap
    resetCoreFlashForTest()
  })

  const core = () => window.quepidSearch.caseRuntime.bootstrap.core

  async function bootstrapCase(caseNo = 2) {
    const flash = { show: vi.fn(), hide: vi.fn() }
    setCoreFlashForTest(flash)
    const failed = vi.fn()
    const ready = vi.fn()
    document.addEventListener("core-bootstrap:failed", failed)
    const controller = Object.create(CoreBootstrapController.prototype)
    controller.caseNoValue = caseNo
    controller.tryNoValue = 1
    controller.communalScorersOnlyValue = "false"
    controller.queryListSortableValue = "true"
    controller.caseToolbarOutlet = { showActions: ready }
    controller.hasCaseToolbarOutlet = true
    await controller.bootstrap()
    document.removeEventListener("core-bootstrap:failed", failed)
    return { flash, failed, ready }
  }

  it("resets the shared window diff store, not the imported fallback singleton", async () => {
    const controller = Object.create(CoreBootstrapController.prototype)
    controller.caseNoValue = 2
    controller.tryNoValue = 1
    controller.communalScorersOnlyValue = "false"
    controller.queryListSortableValue = "true"

    await controller.bootstrap()

    expect(window.quepidStore.diff.reset).toHaveBeenCalledOnce()
    expect(window.quepidStore.diff.disable).toHaveBeenCalledOnce()
    expect(window.quepidSearch.queryCapabilities.resetQueryState).toHaveBeenCalledOnce()
    expect(window.quepidSearch.caseRuntime.bootstrap.core.user.loadCurrent).toHaveBeenCalledOnce()
  })

  it("marks the workspace ready, clears old errors, and reports a successful search", async () => {
    const { flash, ready, failed } = await bootstrapCase()
    await Promise.resolve()

    expect(ready).toHaveBeenCalledOnce()
    expect(window.quepidCoreBootstrap).toEqual({ ready: true, caseNo: 2, tryNo: 1 })
    expect(failed).not.toHaveBeenCalled()
    expect(flash.hide).toHaveBeenCalledWith("search-error")
    expect(core().case.trackLastViewedAt).toHaveBeenCalledWith(2)
    expect(flash.show).toHaveBeenCalledWith("success", "All queries finished successfully!")
  })

  it("flashes the search error when some queries fail after loading", async () => {
    window.quepidSearch.queryCommands.searchAll.mockRejectedValue("engine down")

    const { flash } = await bootstrapCase()
    await new Promise((resolve) => setTimeout(resolve))

    expect(flash.show).toHaveBeenCalledWith("error", "Some queries failed to resolve!")
    expect(flash.show).toHaveBeenCalledWith("error", "engine down", "search-error")
  })

  it("passes a translated search error through intact so the flash can render its links", async () => {
    const error = new SearchError([{ text: "see " }, { text: "wiki", href: "https://example.com" }])
    window.quepidSearch.queryCommands.searchAll.mockRejectedValue(error)

    const { flash } = await bootstrapCase()
    await new Promise((resolve) => setTimeout(resolve))

    expect(flash.show).toHaveBeenCalledWith("error", error, "search-error")
  })

  it("tells a user with no cases how to create one", async () => {
    const { flash, failed, ready } = await bootstrapCase(0)

    expect(flash.show).toHaveBeenCalledWith("error", expect.stringContaining("You don't have any Cases created in Quepid"))
    expect(flash.show).toHaveBeenCalledOnce()
    expect(failed.mock.calls[0][0].detail.error.message).toBe("No case selected")
    expect(ready).not.toHaveBeenCalled()
  })

  it.each([
    [
      "the case can't be loaded",
      () => core().case.load.mockResolvedValue(undefined),
      ["error", expect.stringMatching(/^Could not retrieve case 2\. Confirm that the case has been shared/), "search-error"]
    ],
    [
      "the try doesn't exist",
      () => core().settings.isTrySelected.mockReturnValue(false),
      ["error", "Could not load case 2 due to try number 1 not existing", "search-error"]
    ],
    [
      "the search engine is on the other protocol",
      () => {
        core().navigation.needToRedirectQuepidProtocol.mockReturnValue(true)
        core().navigation.getQuepidProtocol = () => "https"
        core().navigation.createSearchEndpointLink = (id) => `/search_endpoints/${id}`
      },
      ["error", expect.stringMatching(/^Blocked Request: mixed-content\. You have specified a search engine url .*<code>https<\/code>/), "search-error", { html: true }]
    ],
    [
      "anything else goes wrong",
      () => core().case.load.mockRejectedValue(new Error("boom")),
      ["error", "Could not load the case 2 due to: boom", "search-error"]
    ]
  ])("explains the failure when %s", async (_label, arrange, flashArgs) => {
    arrange()

    const { flash, failed, ready } = await bootstrapCase()

    expect(flash.show).toHaveBeenCalledWith(...flashArgs)
    expect(failed).toHaveBeenCalledOnce()
    expect(ready).not.toHaveBeenCalled()
  })

  it("does not block a proxied endpoint on a protocol mismatch", async () => {
    core().settings.editable.mockReturnValue({ searchUrl: "http://search", proxyRequests: true })
    core().navigation.needToRedirectQuepidProtocol.mockReturnValue(true)

    const { ready } = await bootstrapCase()

    expect(ready).toHaveBeenCalledOnce()
  })
})

