import { afterEach, beforeEach } from "vitest"
import {
  resetCoreCapabilitiesForTest,
  resetCoreFlashForTest,
  resetCoreStoresForTest,
  setCoreCapabilitiesForTest,
  setCoreFlashForTest,
  setCoreStoresForTest
} from "utils/core_test_overrides"

let capabilities
let stores
let dom

function installTestBridge(name, read, write) {
  Object.defineProperty(window, name, {
    configurable: true,
    get: read,
    set: write
  })
}

beforeEach(() => {
  capabilities = undefined
  stores = undefined
  dom = undefined

  installTestBridge("quepidSearch", () => capabilities, value => {
    capabilities = value
    setCoreCapabilitiesForTest(value)
  })
  installTestBridge("quepidStore", () => stores, value => {
    stores = value
    setCoreStoresForTest(value)
  })
  installTestBridge("quepidDom", () => dom, value => {
    dom = value
    setCoreFlashForTest(value?.flash)
  })
})

afterEach(() => {
  resetCoreCapabilitiesForTest()
  resetCoreStoresForTest()
  resetCoreFlashForTest()
})
