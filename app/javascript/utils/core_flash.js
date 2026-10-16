import { hideFlash, showFlash } from "utils/flash"

// Controller-facing API; utils/flash owns event delivery and message options.
const coreFlash = { show: showFlash, hide: hideFlash }

export default coreFlash
