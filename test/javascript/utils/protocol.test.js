import { describe, expect, it } from "vitest"
import { switchProtocol } from "utils/protocol"

describe("switchProtocol", () => {
  it("moves to https on the default port, whatever the dev port", () => {
    expect(switchProtocol("http://localhost:3000/case/5/try/1", "https").toString()).toBe(
      "https://localhost/case/5/try/1"
    )
    expect(switchProtocol("http://localhost:3001/case/5", "https").toString()).toBe(
      "https://localhost/case/5"
    )
  })

  it("keeps the port when moving to http", () => {
    expect(switchProtocol("https://quepid.test:8443/case/5", "http").toString()).toBe(
      "http://quepid.test:8443/case/5"
    )
  })

  it("resolves a relative href against a base and leaves a matching protocol alone", () => {
    expect(switchProtocol("/case/5", "http", "http://localhost:3000/books/2").toString()).toBe(
      "http://localhost:3000/case/5"
    )
  })

  it("refuses protocols other than http and https", () => {
    expect(switchProtocol("/case/5", "javascript", "http://localhost:3000/")).toBeNull()
  })
})
