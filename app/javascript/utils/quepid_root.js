/**
 * Quepid root URL for navigation when a server-rendered URL is not available.
 * Prefer Rails path helpers passed as Stimulus `data-*-url-value` attributes.
 *
 * Layouts set `data-quepid-root-url` on `<body>` via the Rails helper
 * `quepid_root_url`. Respects RAILS_RELATIVE_URL_ROOT for subpath deployments.
 *
 * @returns {string} Root URL with no trailing slash, or "" if not set.
 */
let _warnedEmpty = false

export function getQuepidRootUrl() {
  const root = document.body?.dataset?.quepidRootUrl ?? ""
  if (!root && !_warnedEmpty) {
    _warnedEmpty = true
    console.warn(
      "[Quepid] data-quepid-root-url is empty. Set it on <body> via quepid_root_url. " +
        "Prefer server-passed URLs; see DEVELOPER_GUIDE § Stimulus HTTP conventions."
    )
  }
  return root
}
