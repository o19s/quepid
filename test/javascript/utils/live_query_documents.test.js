import { describe, expect, it, vi } from "vitest"
import { createLiveQueryDocumentsRuntime } from "utils/live_query_documents"
import { SearchError } from "utils/search_error"

describe("live query documents runtime", () => {
  function buildRuntime(publish = vi.fn()) {
    const docList = {
      list: vi.fn().mockReturnValue([{ id: "doc-1" }]),
      hasErrors: vi.fn().mockReturnValue(false),
      errorMsg: vi.fn().mockReturnValue("document error")
    }
    const createDocList = vi.fn().mockReturnValue(docList)
    const runtime = createLiveQueryDocumentsRuntime({
      getFieldSpec: vi.fn().mockReturnValue({ id: "id" }),
      createDocList,
      matchFeaturesExplain: vi.fn(),
      publish
    })
    return { runtime, docList, createDocList, publish }
  }

  function query() {
    return {
      docs: [{ id: "old" }],
      docsSet: false,
      errorText: "old error",
      numFound: 1,
      ratingsStore: {},
      setDirty: vi.fn(),
      resultsReturned: false
    }
  }

  it("resets query-local result state", () => {
    const { runtime } = buildRuntime()
    const liveQuery = query()

    runtime.reset(liveQuery)

    expect(liveQuery.errorText).toBe("")
    expect(liveQuery.resultsReturned).toBe(false)
    expect(liveQuery.docs).toEqual([])
  })

  it("normalizes and publishes returned documents", () => {
    const { runtime, createDocList, publish } = buildRuntime()
    const liveQuery = query()

    const result = runtime.setDocs(liveQuery, [{ id: "raw" }], 7)

    expect(result).toBe(false)
    expect(createDocList).toHaveBeenCalledOnce()
    expect(liveQuery.docs).toEqual([{ id: "doc-1" }])
    expect(liveQuery.docsSet).toBe(true)
    expect(liveQuery.numFound).toBe(7)
    expect(liveQuery.setDirty).toHaveBeenCalledOnce()
    expect(publish).toHaveBeenLastCalledWith(liveQuery)
  })

  it("publishes a document-list error while preserving the error result", () => {
    const publish = vi.fn()
    const { runtime, docList } = buildRuntime(publish)
    docList.hasErrors.mockReturnValue(true)
    const liveQuery = query()

    const result = runtime.setDocs(liveQuery, [], 0)

    expect(result).toBe("document error")
    expect(liveQuery.errorText).toBe("document error")
    expect(publish).toHaveBeenCalledWith(liveQuery)
    expect(publish).toHaveBeenLastCalledWith(liveQuery)
  })

  it("publishes explicit search errors", () => {
    const { runtime, publish } = buildRuntime()
    const liveQuery = query()

    runtime.setError(liveQuery, "search failed")

    expect(liveQuery.errorText).toBe("search failed")
    expect(publish).toHaveBeenCalledOnce()
  })

  it("stores a translated search error as escaped markup with its links", () => {
    const { runtime } = buildRuntime()
    const liveQuery = query()

    runtime.setError(liveQuery, new SearchError([
      { text: "<i>bad</i> " },
      { text: "inspect", href: "http://solr.test/" }
    ]))

    expect(liveQuery.errorText).toBe(
      '&lt;i&gt;bad&lt;/i&gt; <a href="http://solr.test/" target="_blank" rel="noopener noreferrer">inspect</a>'
    )
  })
})
