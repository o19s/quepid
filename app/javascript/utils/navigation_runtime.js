export function createNavigationRuntime({
  location = globalThis.location,
  window = globalThis.window
} = {}) {
  let caseNo = 0
  let tryNo = 0

  const currentLocation = () => location || {}
  const absoluteUrl = () => currentLocation().href || currentLocation().toString()

  return {
    isLoading: () => false,
    navigateTo: (caseTryObj) => {
      let navCaseNo = caseNo
      let navTryNo = tryNo
      const search = new URLSearchParams(currentLocation().search || "")
      const sortBy = search.get("sort")
      const sortOrder = search.get("reverse")

      if (Object.prototype.hasOwnProperty.call(caseTryObj, "caseNo")) {
        navCaseNo = Number.parseInt(caseTryObj.caseNo, 10)
      }
      if (Object.prototype.hasOwnProperty.call(caseTryObj, "tryNo")) {
        navTryNo = Number.parseInt(caseTryObj.tryNo, 10)
      } else if (Object.prototype.hasOwnProperty.call(caseTryObj, "caseNo")) {
        navTryNo = 1
      }

      let url = `${navigationRootUrl()}/case/${navCaseNo}/try/${navTryNo}`
      const query = new URLSearchParams()
      if (sortBy) query.set("sort", sortBy)
      if (sortOrder) query.set("reverse", sortOrder)
      if (caseTryObj.startTour === true) query.set("startTour", "true")
      const queryString = query.toString()
      if (queryString) url += `?${queryString}`

      window?.location?.assign(url)
    },
    navigationCompleted: (caseTryObj) => {
      caseNo = caseTryObj.caseNo
      tryNo = caseTryObj.tryNo
    },
    getCaseNo: () => caseNo,
    getTryNo: () => tryNo,
    needToRedirectQuepidProtocol: (searchUrl) => {
      if (!searchUrl) return false
      return (currentLocation().protocol === "https:") !== searchUrl.startsWith("https")
    },
    swapQuepidUrlTLS: () => {
      const url = absoluteUrl().replace(":3000", "")
      const queryIndex = url.indexOf("?")
      const isHttps = url.startsWith("https")
      let base = url.substring(0, queryIndex === -1 ? url.length : queryIndex)
      const protocol = isHttps ? "http" : "https"
      base = isHttps ? base.replace("https", "http") : base.replace("http", "https")
      return [`${base}?protocolToSwitchTo=${protocol}`, protocol]
    },
    getQuepidProtocol: () => (absoluteUrl().startsWith("https") ? "http" : "https"),
    appendQueryParams: (url, params) => `${url}${url.includes("?") ? "&" : "?"}${params}`,
    getQuepidRootUrl: navigationRootUrl,
    getQuepidProxyUrl: (searchEndpointId) => {
      let base = `${navigationRootUrl()}/proxy/fetch?`
      if (searchEndpointId) base += `search_endpoint_id=${searchEndpointId}&`
      return `${base}url=`
    },
    createSearchEndpointLink: (searchEndpointId) =>
      `${navigationRootUrl()}/search_endpoints/${searchEndpointId}`,
    reset: () => {
      caseNo = 0
      tryNo = 0
    }
  }

  function navigationRootUrl() {
    let url = absoluteUrl()
    if (!url.endsWith("/")) url += "/"
    const match = url.match(/(.*?)(\/case\/)/)
    if (match?.[1]) return match[1]
    return new URL(url).origin
  }
}
