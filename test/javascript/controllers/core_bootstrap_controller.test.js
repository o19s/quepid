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
      caseRuntime: {
        bootstrap: {
          configurationSvc: {
            setCommunalScorersOnly: vi.fn(),
            setQueryListSortable: vi.fn(),
            setCaseNo: vi.fn(),
            setTryNo: vi.fn()
          },
          userSvc: { getCurrentUser: vi.fn().mockResolvedValue({ id: 7 }) },
          caseSvc: {
            get: vi.fn().mockResolvedValue({ tries: [], lastTry: 1 }),
            selectTheCase: vi.fn(),
            trackLastViewedAt: vi.fn(),
            fetchDropdownCases: vi.fn()
          },
          settingsSvc: {
            editableSettings: vi.fn().mockReturnValue({ searchUrl: "http://search" }),
            setCaseTries: vi.fn(),
            setCurrentTry: vi.fn(),
            isTrySelected: vi.fn().mockReturnValue(true)
          },
          querySnapshotSvc: { bootstrap: vi.fn() },
          caseTryNavSvc: {
            getCaseNo: vi.fn().mockReturnValue(1),
            getTryNo: vi.fn().mockReturnValue(1),
            navigationCompleted: vi.fn(),
            needToRedirectQuepidProtocol: vi.fn().mockReturnValue(false)
          },
          queriesSvc: {
            queries: {},
            reset: vi.fn(),
            querySearchPromiseReset: vi.fn(),
            changeSettings: vi.fn().mockResolvedValue(undefined),
            searchAll: vi.fn().mockResolvedValue(undefined)
          },
          docCacheSvc: { empty: vi.fn(), invalidate: vi.fn(), update: vi.fn().mockResolvedValue(undefined) },
          scorerSvc: { bootstrap: vi.fn() },
          paneSvc: { refreshElements: vi.fn() }
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
    expect(window.quepidSearch.caseRuntime.bootstrap.userSvc.getCurrentUser).toHaveBeenCalledOnce()
  })
})
