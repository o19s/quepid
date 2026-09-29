/**
 * Install the public live-query namespace without coupling registration to
 * the case client or to the runtime that constructs the callback implementations.
 */
export function installLiveQueryCapabilities({
  target,
  capabilities = {},
  commands = {},
  lifecycle = {},
  targetedSearch
}) {
  target.queryCapabilities ||= {}
  target.queryCommands ||= {}
  target.queryLifecycle ||= {}

  Object.assign(target.queryCapabilities, capabilities)
  Object.assign(target.queryCommands, commands)
  Object.assign(target.queryLifecycle, lifecycle)

  if (targetedSearch) target.targetedSearch = targetedSearch

  return target
}
