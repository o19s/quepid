import { describe, expect, it, vi } from "vitest"
import { installLiveQueryCapabilities } from "utils/live_query_capabilities"

describe("installLiveQueryCapabilities", () => {
  it("installs capabilities, commands, lifecycle callbacks, and targeted search", () => {
    const target = {}
    const capabilities = { getQuery: vi.fn() }
    const commands = { searchAll: vi.fn() }
    const lifecycle = { prepareQueries: vi.fn() }
    const targetedSearch = vi.fn()

    expect(installLiveQueryCapabilities({
      target,
      capabilities,
      commands,
      lifecycle,
      targetedSearch
    })).toBe(target)

    expect(target.queryCapabilities).toEqual(capabilities)
    expect(target.queryCommands).toEqual(commands)
    expect(target.queryLifecycle).toEqual(lifecycle)
    expect(target.targetedSearch).toBe(targetedSearch)
  })

  it("preserves existing namespaces when adding a partial contract", () => {
    const target = {
      queryCapabilities: { existing: true },
      queryCommands: { existing: true },
      queryLifecycle: { existing: true }
    }

    installLiveQueryCapabilities({
      target,
      capabilities: { added: true }
    })

    expect(target.queryCapabilities).toEqual({ existing: true, added: true })
    expect(target.queryCommands).toEqual({ existing: true })
    expect(target.queryLifecycle).toEqual({ existing: true })
  })
})
