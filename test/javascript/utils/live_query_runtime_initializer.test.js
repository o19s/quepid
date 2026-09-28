import { afterEach, describe, expect, it, vi } from "vitest"
import quepidSearch from "quepid_search"
import { initializeLiveQueryRuntime } from "utils/live_query_runtime_initializer"

const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe("initializeLiveQueryRuntime", () => {
  afterEach(() => {
    delete window.quepidStore
    delete quepidSearch.splainerSearch
    window.quepidSearch = quepidSearch
    quepidSearch.queryCapabilities.getCaseNo = null
  })

  it("installs the live-query boundary from explicit service dependencies", () => {
    window.quepidSearch = quepidSearch
    quepidSearch.splainerSearch = {
      searchSvc: { createSearcher: vi.fn() },
      normalDocsSvc: { createNormalDoc: vi.fn(), explainDoc: vi.fn() },
      esExplainExtractorSvc: { docsWithExplainOther: vi.fn() },
      solrExplainExtractorSvc: { docsWithExplainOther: vi.fn() }
    }

    initializeLiveQueryRuntime({
      $rootScope: { $evalAsync: callback => callback(), $applyAsync: callback => callback() },
      $http: vi.fn(() => Promise.resolve({ data: {} })),
      $q: { defer: deferred, reject: Promise.reject, resolve: Promise.resolve },
      $log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
      scorerSvc: {
        defaultScorer: { getColors: () => [] },
        constructFromData: vi.fn(),
        setDefault: vi.fn(),
        bootstrap: vi.fn()
      },
      caseTryNavSvc: { getQuepidProxyUrl: vi.fn() },
      settingsSvc: {
        editableSettings: vi.fn(() => ({})),
        applicableSettings: vi.fn(() => ({})),
        isTrySelected: vi.fn(() => false),
        previewArgs: vi.fn()
      },
      searchEndpointSvc: { isEsOrOsEngine: vi.fn() }
    })

    expect(window.quepidSearch.queryCapabilities.getCaseNo()).toBe(-1)
    expect(window.quepidSearch.queryCommands.searchAll).toEqual(expect.any(Function))
    expect(window.quepidSearch.queryLifecycle.refreshQueries).toEqual(expect.any(Function))
  })
})
