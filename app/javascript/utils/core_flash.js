import { hideFlash, showFlash } from "utils/flash"
import { getCoreFlashOverride } from "utils/core_test_overrides"

const moduleFlash = { show: showFlash, hide: hideFlash }

// Keep existing unit-test fakes injectable without publishing a production
// runtime bridge from the core bundle.
const coreFlash = new Proxy(moduleFlash, {
  get(target, property) {
    return getCoreFlashOverride()?.[property] || target[property]
  }
})

export default coreFlash
