import fc from "fast-check"
import { describe, expect, it, vi } from "vitest"
import { documentUrlFor } from "utils/live_query_read_models"

describe("document link capability properties", () => {
  it("never exposes a mapper document URL without an explicit capability", () => {
    fc.assert(
      fc.property(
        fc.webUrl(),
        fc.constantFrom(false, undefined, null, "true"),
        (url, supported) => {
          const proxyUrlFor = vi.fn(() => "proxy?url=")
          expect(
            documentUrlFor(
              { _url: () => url },
              {
                settings: {
                  searchEngine: "searchapi",
                  mapperBasedSearchEngineSupportsDirectDocumentLookup: supported,
                  proxyRequests: true
                },
                proxyUrlFor
              }
            )
          ).toBeNull()
          expect(proxyUrlFor).not.toHaveBeenCalled()
        }
      )
    )
  })
})
