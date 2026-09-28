import { apiFetch } from "api/fetch"
import { extractCuratorVars } from "utils/curator_vars"

const clone = (value) => JSON.parse(JSON.stringify(value))

function responseData(response, message) {
  if (!response.ok) throw new Error(`${message} (${response.status})`)
  if (response.status === 204 || typeof response.json !== "function") return null
  return response.json().catch(() => null)
}

function createTry(data, { request, caseNo, createFieldSpec }) {
  const source = { ...data }
  if (source.query_params === null)
    source.query_params = source.search_engine === "solr" ? "" : "{}"

  const currentTry = {
    args: source.args,
    deleted: false,
    escapeQuery: source.escape_query,
    apiMethod: source.api_method,
    jsonQueryParams: source.json_query_params,
    customHeaders: source.custom_headers,
    fieldSpec: source.field_spec,
    name: source.name,
    numberOfRows: source.number_of_rows,
    queryParams: source.query_params,
    searchEngine: source.search_engine,
    mapperBasedSearchEngineId: source.mapper_based_search_engine_id,
    mapperBasedSearchEngineName: source.mapper_based_search_engine_name,
    mapperBasedSearchEngineSupportsPagination:
      source.mapper_based_search_engine_supports_pagination,
    mapperBasedSearchEnginePaginationHitsParam:
      source.mapper_based_search_engine_pagination_hits_param,
    mapperBasedSearchEnginePaginationOffsetParam:
      source.mapper_based_search_engine_pagination_offset_param,
    mapperBasedSearchEngineSupportsRatedDocsLookup:
      source.mapper_based_search_engine_supports_rated_docs_lookup,
    searchEndpointId: source.search_endpoint_id,
    endpointName: source.endpoint_name,
    searchUrl: source.search_url,
    tryNo: source.try_number,
    basicAuthCredential: source.basic_auth_credential,
    mapperCode: source.mapper_code,
    proxyRequests: source.proxy_requests,
    options: source.options,
    endpointArchived: source.endpoint_archived,
    requestsPerMinute: source.requests_per_minute,
    curatorVars: Object.entries(source.curator_vars || {}).map(([name, value]) => ({ name, value }))
  }

  currentTry.curatorVarsDict = () =>
    Object.fromEntries(currentTry.curatorVars.map((variable) => [variable.name, variable.value]))
  currentTry.hasVar = (name) =>
    Object.prototype.hasOwnProperty.call(currentTry.curatorVarsDict(), name)
  currentTry.getVar = (name) =>
    currentTry.curatorVars.find((variable) => variable.name === name) || false
  currentTry.forEachVar = (callback) => currentTry.curatorVars.forEach(callback)
  currentTry.sortVars = () => currentTry.curatorVars.sort((a, b) => a.name.localeCompare(b.name))
  currentTry.addVar = (name, value) => {
    if (!currentTry.hasVar(name)) currentTry.curatorVars.push({ name, value })
  }
  currentTry.updateVars = () => {
    currentTry.curatorVars.forEach((variable) => {
      variable.inQueryParams = false
    })
    extractCuratorVars(currentTry.queryParams || "").forEach((name) => {
      currentTry.addVar(name, 10)
      const variable = currentTry.getVar(name)
      variable.inQueryParams = true
    })
    currentTry.sortVars()
  }
  currentTry.createFieldSpec = () => createFieldSpec(currentTry.fieldSpec)
  currentTry.rename = async (name) => {
    const response = await request(`api/cases/${caseNo()}/tries/${currentTry.tryNo}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ name })
    })
    await responseData(response, "Unable to rename try")
    currentTry.name = name
  }
  currentTry.updateVars()
  return currentTry
}

export function createSettingsRuntime({
  request = apiFetch,
  caseNo = () => null,
  tryNo = () => null,
  navigate = () => {},
  createFieldSpec = (value) => value
} = {}) {
  let state = null
  let settingsId = 0

  const createState = (tries) => {
    const current = {
      tries: [],
      selectedTry: null,
      settingsId: settingsId++
    }
    const getTry = (number) => current.tries.find((item) => item.tryNo === number) || null
    const selectTry = (number) => {
      current.selectedTry = getTry(number)
    }
    const activeTries = () => current.tries.filter((item) => !item.deleted)

    current.getTry = getTry
    current.selectTry = selectTry
    current.numTries = () => activeTries().length
    current.lastTry = () => activeTries().at(-1) || null
    current.addTry = (data) => {
      const item = createTry(data, { request, caseNo, createFieldSpec })
      current.tries.push(item)
      return item
    }
    current.deleteTry = async (number) => {
      if (current.numTries() <= 1) return
      const item = getTry(number)
      if (!item) return
      const response = await request(`api/cases/${caseNo()}/tries/${number}`, {
        method: "DELETE",
        headers: { Accept: "application/json" }
      })
      await responseData(response, "Unable to delete try")
      item.deleted = true
      settingsId++
      if (current.selectedTry?.tryNo === number) navigate({ tryNo: current.lastTry().tryNo })
    }
    current.duplicateTry = async (number) => {
      const response = await request(`api/clone/cases/${caseNo()}/tries/${number}`, {
        method: "POST",
        headers: { Accept: "application/json" }
      })
      const data = await responseData(response, "Unable to duplicate try")
      const item = createTry(data, { request, caseNo, createFieldSpec })
      current.tries.unshift(item)
      settingsId++
      return item
    }
    current.renameTry = async (number, name) => {
      const item = getTry(number)
      if (!item) return
      await item.rename(name)
      settingsId++
    }
    tries.forEach((item) => current.addTry(item))
    return current
  }

  const editable = () => {
    if (!state) return {}
    const settings = { ...state, tries: state.tries, selectedTry: state.selectedTry }
    const selectedTry = state.selectedTry
    if (!selectedTry) return settings
    Object.assign(settings, {
      escapeQuery: selectedTry.escapeQuery,
      apiMethod: selectedTry.apiMethod,
      customHeaders: selectedTry.customHeaders || "",
      fieldSpec: selectedTry.fieldSpec,
      numberOfRows: selectedTry.numberOfRows,
      queryParams: selectedTry.queryParams,
      searchEngine: selectedTry.searchEngine,
      searchEndpointId: selectedTry.searchEndpointId,
      searchUrl: selectedTry.searchUrl,
      proxyRequests: selectedTry.proxyRequests,
      basicAuthCredential: selectedTry.basicAuthCredential,
      mapperCode: selectedTry.mapperCode,
      options: selectedTry.options,
      headerType:
        typeof selectedTry.customHeaders === "object" && selectedTry.customHeaders
          ? JSON.stringify(selectedTry.customHeaders).includes("ApiKey")
            ? "API Key"
            : "Custom"
          : "None"
    })
    settings.createFieldSpec = () => selectedTry.createFieldSpec()
    return settings
  }

  const payloadFor = (settings) => {
    settings.selectedTry.updateVars()
    const payload = {
      try: {
        escape_query: settings.escapeQuery,
        field_spec: settings.fieldSpec,
        number_of_rows: settings.numberOfRows,
        query_params: settings.selectedTry.queryParams
      },
      parent_try_number: settings.selectedTry.tryNo,
      curator_vars: settings.selectedTry.curatorVarsDict()
    }
    if (settings.searchEndpointId) payload.try.search_endpoint_id = settings.searchEndpointId
    else {
      payload.search_endpoint = {
        search_engine: settings.searchEngine,
        endpoint_url: settings.searchUrl,
        api_method: settings.apiMethod,
        custom_headers: settings.customHeaders,
        basic_auth_credential: settings.basicAuthCredential,
        mapper_code: settings.mapperCode,
        proxy_requests: settings.proxyRequests,
        ...(settings.searchEnginePreset && settings.searchEnginePreset !== settings.searchEngine
          ? { mapper_based_search_engine_id: settings.searchEnginePreset }
          : {})
      }
    }
    return payload
  }

  return {
    setCaseTries: (tries) => {
      state = createState(tries || [])
    },
    setCurrentTry: (number) => state?.selectTry(number),
    isTrySelected: () => Boolean(state?.selectedTry),
    editable,
    applicable: () => state?.selectedTry || {},
    settingsId: () => (state ? state.settingsId : -1),
    save: async (settings) => {
      if (settings.inError) return
      const response = await request(`api/cases/${caseNo()}/tries`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          ...payloadFor(settings),
          parent_try_number: settings.selectedTry.tryNo
        })
      })
      const data = await responseData(response, "Unable to save settings")
      const item = state.addTry(data)
      state.selectTry(item.tryNo)
      document.dispatchEvent(
        new CustomEvent("case-settings:updated", { detail: { caseNo: caseNo(), lastTry: item } })
      )
      navigate({ tryNo: item.tryNo })
    },
    update: async (settings) => {
      if (settings.inError) return
      settings.selectedTry.updateVars()
      settings.selectedTry.apiMethod = settings.apiMethod
      settings.selectedTry.queryParams = settings.queryParams
      const payload = payloadFor(settings)
      const response = await request(`api/cases/${caseNo()}/tries/${tryNo()}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload)
      })
      await responseData(response, "Unable to update settings")
      document.dispatchEvent(
        new CustomEvent("case-settings:updated", {
          detail: { caseNo: caseNo(), lastTry: settings.selectedTry }
        })
      )
      navigate({ tryNo: settings.selectedTry.tryNo })
    },
    duplicateTry: (number) => state?.duplicateTry(number),
    renameTry: (number, name) => state?.renameTry(number, name),
    deleteTry: (number) => state?.deleteTry(number),
    previewArgs: async (number, queryParams) => {
      const response = await request(`api/cases/${caseNo()}/tries/${number}/preview_args`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query_params: queryParams })
      })
      const data = await responseData(response, "Unable to preview query settings")
      return data.args
    },
    reset: () => {
      state = null
    }
  }
}
