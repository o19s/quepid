import { CORE_EVENTS } from "utils/core_events"
import { deleteJson, postJson, putJson } from "api/json"
import { extractCuratorVars } from "utils/curator_vars"

function createTry(data, { caseNo, createFieldSpec }) {
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
    await putJson(`api/cases/${caseNo()}/tries/${currentTry.tryNo}`, { name })
    currentTry.name = name
  }
  currentTry.updateVars()
  return currentTry
}

export function createSettingsRuntime({
  caseNo = () => null,
  tryNo = () => null,
  navigate = () => {},
  createFieldSpec = (value) => value
} = {}) {
  let tries = null
  let selectedTry = null

  const getTry = (number) => tries?.find((item) => item.tryNo === number) || null
  const selectTry = (number) => {
    selectedTry = getTry(number)
  }
  const activeTries = () => (tries || []).filter((item) => !item.deleted)
  const addTry = (data) => {
    const item = createTry(data, { caseNo, createFieldSpec })
    tries.push(item)
    return item
  }

  const formSettings = (currentTry) => {
    return {
      escapeQuery: currentTry.escapeQuery,
      apiMethod: currentTry.apiMethod,
      customHeaders: currentTry.customHeaders || "",
      fieldSpec: currentTry.fieldSpec,
      numberOfRows: currentTry.numberOfRows,
      queryParams: currentTry.queryParams,
      searchEngine: currentTry.searchEngine,
      searchEndpointId: currentTry.searchEndpointId,
      searchUrl: currentTry.searchUrl,
      proxyRequests: currentTry.proxyRequests,
      basicAuthCredential: currentTry.basicAuthCredential,
      mapperCode: currentTry.mapperCode,
      options: currentTry.options,
      headerType:
        typeof currentTry.customHeaders === "object" && currentTry.customHeaders
          ? JSON.stringify(currentTry.customHeaders).includes("ApiKey")
            ? "API Key"
            : "Custom"
          : "None",
      createFieldSpec: () => currentTry.createFieldSpec()
    }
  }

  const editable = () => {
    if (!tries) return {}
    return {
      tries,
      selectedTry,
      getTry,
      ...(selectedTry ? formSettings(selectedTry) : {})
    }
  }

  const draft = () => {
    if (!selectedTry) return null
    const currentTry = selectedTry
    return {
      ...formSettings(currentTry),
      tryNo: currentTry.tryNo,
      endpointName: currentTry.endpointName,
      endpointArchived: currentTry.endpointArchived,
      mapperBasedSearchEngineId: currentTry.mapperBasedSearchEngineId,
      mapperBasedSearchEngineName: currentTry.mapperBasedSearchEngineName,
      get queryParams() {
        return currentTry.queryParams
      },
      set queryParams(value) {
        currentTry.queryParams = value
      },
      curatorVars: currentTry.curatorVars,
      updateVars: () => currentTry.updateVars(),
      curatorVarsDict: () => currentTry.curatorVarsDict(),
      applyEndpoint(values) {
        Object.assign(this, values)
        Object.assign(currentTry, values)
      }
    }
  }

  const payloadFor = (settings) => {
    settings.updateVars()
    const payload = {
      try: {
        escape_query: settings.escapeQuery,
        field_spec: settings.fieldSpec,
        number_of_rows: settings.numberOfRows,
        query_params: settings.queryParams
      },
      parent_try_number: settings.tryNo,
      curator_vars: settings.curatorVarsDict()
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
    setCaseTries: (data) => {
      tries = []
      selectedTry = null
      for (const item of data || []) addTry(item)
    },
    setCurrentTry: selectTry,
    isTrySelected: () => Boolean(selectedTry),
    editable,
    draft,
    tries: () => tries || [],
    applicable: () => selectedTry || {},
    save: async (settings) => {
      if (settings.inError) return
      const data = await postJson(`api/cases/${caseNo()}/tries`, payloadFor(settings))
      const item = addTry(data)
      selectTry(item.tryNo)
      return item
    },
    update: async (settings) => {
      if (settings.inError) return
      settings.selectedTry.updateVars()
      settings.selectedTry.apiMethod = settings.apiMethod
      settings.selectedTry.queryParams = settings.queryParams
      const payload = payloadFor({
        ...settings,
        tryNo: settings.selectedTry.tryNo,
        queryParams: settings.selectedTry.queryParams,
        updateVars: () => settings.selectedTry.updateVars(),
        curatorVarsDict: () => settings.selectedTry.curatorVarsDict()
      })
      await putJson(`api/cases/${caseNo()}/tries/${tryNo()}`, payload)
      document.dispatchEvent(
        new CustomEvent(CORE_EVENTS.CASE_SETTINGS_UPDATED, {
          detail: { caseNo: caseNo(), lastTry: settings.selectedTry }
        })
      )
      navigate({ tryNo: settings.selectedTry.tryNo })
    },
    duplicateTry: async (number) => {
      if (!tries) return
      const data = await postJson(`api/clone/cases/${caseNo()}/tries/${number}`)
      const item = createTry(data, { caseNo, createFieldSpec })
      tries.unshift(item)
      return item
    },
    renameTry: async (number, name) => {
      await getTry(number)?.rename(name)
    },
    deleteTry: async (number) => {
      if (activeTries().length <= 1) return
      const item = getTry(number)
      if (!item) return
      await deleteJson(`api/cases/${caseNo()}/tries/${number}`)
      item.deleted = true
      if (selectedTry?.tryNo === number) navigate({ tryNo: activeTries().at(-1).tryNo })
    },
    previewArgs: async (number, queryParams) => {
      const data = await postJson(`api/cases/${caseNo()}/tries/${number}/preview_args`, {
        query_params: queryParams
      })
      return data.args
    },
    reset: () => {
      tries = null
      selectedTry = null
    }
  }
}
