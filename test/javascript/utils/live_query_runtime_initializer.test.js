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
      framework: {
        request: vi.fn(() => Promise.resolve({ data: {} })),
        get: vi.fn(() => Promise.resolve({ data: {} })),
        promiseApi: { defer: deferred, reject: Promise.reject, resolve: Promise.resolve },
        schedule: callback => callback(),
        applyAsync: callback => callback(),
        logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
        reject: Promise.reject,
        resolve: Promise.resolve
      },
      domain: {
        settings: {
          editable: vi.fn(() => ({})),
          applicable: vi.fn(() => ({})),
          isTrySelected: vi.fn(() => false),
          previewArgs: vi.fn()
        },
        scorer: {
          getDefault: vi.fn(() => ({ getColors: () => [] })),
          constructFromData: vi.fn(),
          setDefault: vi.fn(),
          bootstrap: vi.fn()
        },
        navigation: { proxyUrlFor: vi.fn() }
      }
    })

    expect(window.quepidSearch.queryCapabilities.getCaseNo()).toBe(-1)
    expect(window.quepidSearch.queryCommands.searchAll).toEqual(expect.any(Function))
    expect(window.quepidSearch.queryLifecycle.refreshQueries).toEqual(expect.any(Function))
  })
})
