let capabilities
let stores
let flash

export function setCoreCapabilitiesForTest(value) {
  capabilities = value
}
export function resetCoreCapabilitiesForTest() {
  capabilities = undefined
}
export function getCoreCapabilitiesOverride() {
  return capabilities
}

export function setCoreStoresForTest(value) {
  stores = value
}
export function resetCoreStoresForTest() {
  stores = undefined
}
export function getCoreStoresOverride() {
  return stores
}

export function setCoreFlashForTest(value) {
  flash = value
}
export function resetCoreFlashForTest() {
  flash = undefined
}
export function getCoreFlashOverride() {
  return flash
}
