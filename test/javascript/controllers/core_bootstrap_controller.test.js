import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import CoreBootstrapController from "controllers/core_bootstrap_controller"

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
            },
            scoring: { bootstrap: vi.fn() }
          },
          liveQuery: null,
          docCache: { empty: vi.fn(), invalidate: vi.fn(), update: vi.fn().mockResolvedValue(undefined) }
        }
      }
    }
  })

  afterEach(() => {
    delete window.quepidStore
    delete window.quepidSearch
  })

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
})
