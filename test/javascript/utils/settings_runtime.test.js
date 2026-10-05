import { afterEach, describe, expect, it, vi } from "vitest"
import { createSettingsRuntime } from "utils/settings_runtime"

const response = (data = {}, status = 200) => ({
  async text() {
    return JSON.stringify(await this.json()) || ""
  },
  ok: true,
  status,
  json: vi.fn(async () => data)
})

const tryData = (tryNumber = 1) => ({
  try_number: tryNumber,
  name: `Try ${tryNumber}`,
  query_params: "q=#$query##&bq=title^##boost##",
  curator_vars: { boost: 2 },
  search_engine: "solr",
  search_url: "https://search.example.test/select",
  field_spec: "id:id, title:title",
  escape_query: true,
  api_method: "GET",
  number_of_rows: 10,
  custom_headers: "",
  proxy_requests: false
})

describe("settings runtime", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("maps tries, selects the active try, and tracks curator variables", () => {
    const runtime = createSettingsRuntime({ createFieldSpec: value => ({ value }) })
    runtime.setCaseTries([tryData(1), tryData(2)])
    runtime.setCurrentTry(2)

    const settings = runtime.editable()

    expect(settings.selectedTry.tryNo).toBe(2)
    expect(settings.searchUrl).toBe("https://search.example.test/select")
    expect(settings.selectedTry.curatorVarsDict()).toEqual({ boost: 2 })
    expect(settings.selectedTry.getVar("boost").inQueryParams).toBe(true)
    expect(settings.selectedTry.createFieldSpec()).toEqual({ value: "id:id, title:title" })
    expect(settings.createFieldSpec()).toEqual({ value: "id:id, title:title" })
  })

  it("keeps query, curator and endpoint edits shared while form fields reset after history changes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response()))
    const runtime = createSettingsRuntime({ caseNo: () => 9 })
    expect(runtime.draft()).toBeNull()
    runtime.setCaseTries([tryData(1), tryData(2)])
    runtime.setCurrentTry(1)
    const selected = runtime.applicable()
    const form = runtime.draft()
    form.queryParams = "q=#$query##&boost=##boost##"
    form.curatorVars[0].value = "8"
    form.numberOfRows = 23
    form.fieldSpec = "id,title"
    form.escapeQuery = false
    form.applyEndpoint({ searchEndpointId: 7, searchUrl: "http://new/select", searchEngine: "solr", endpointName: "New" })

    expect(selected.queryParams).toBe(form.queryParams)
    expect(form.curatorVars).toBe(selected.curatorVars)
    expect(selected.curatorVarsDict()).toEqual({ boost: "8" })
    expect(selected.searchEndpointId).toBe(7)
    expect(selected.numberOfRows).toBe(10)
    expect(selected.fieldSpec).toBe("id:id, title:title")
    expect(selected.escapeQuery).toBe(true)
    await runtime.renameTry(2, "Renamed")
    const reloaded = runtime.draft()
    expect(reloaded).toMatchObject({ numberOfRows: 10, fieldSpec: "id:id, title:title", escapeQuery: true, queryParams: form.queryParams, searchEndpointId: 7 })
    expect(reloaded.curatorVars).toBe(selected.curatorVars)
    expect(runtime.tries().find(item => item.tryNo === 2).name).toBe("Renamed")
  })

  it("retains shared wizard edits before a failed update without applying the response", async () => {
    const request = vi.fn().mockResolvedValue({ ok: false, status: 503, text: async () => "", json: async () => null })
    const navigate = vi.fn()
    vi.stubGlobal("fetch", request)
    const runtime = createSettingsRuntime({ caseNo: () => 9, tryNo: () => 1, navigate })
    runtime.setCaseTries([tryData(1)])
    runtime.setCurrentTry(1)
    const settings = runtime.editable()
    settings.apiMethod = "POST"
    settings.queryParams = "q=wizard"
    settings.numberOfRows = 25

    const pending = runtime.update(settings)
    expect(runtime.applicable()).toMatchObject({ apiMethod: "POST", queryParams: "q=wizard", numberOfRows: 10 })
    await expect(pending).rejects.toThrow("Request failed (503)")
    expect(navigate).not.toHaveBeenCalled()
    request.mockResolvedValue(response({ ...tryData(1), number_of_rows: 99 }))
    await runtime.update(settings)
    expect(runtime.applicable().numberOfRows).toBe(10)
    expect(navigate).toHaveBeenCalledWith({ tryNo: 1 })
  })

  it("updates settings through the API and publishes the changed try", async () => {
    const request = vi.fn().mockResolvedValue(response())
    const navigate = vi.fn()
    vi.stubGlobal("fetch", request)
    const runtime = createSettingsRuntime({ caseNo: () => 9, tryNo: () => 1, navigate })
    runtime.setCaseTries([tryData(1)])
    runtime.setCurrentTry(1)
    const settings = runtime.editable()
    settings.numberOfRows = 25

    await runtime.update(settings)

    expect(request).toHaveBeenCalledWith("api/cases/9/tries/1", expect.objectContaining({ method: "PUT" }))
    expect(JSON.parse(request.mock.calls[0][1].body)).toMatchObject({
      try: { number_of_rows: 25, field_spec: "id:id, title:title" },
      parent_try_number: 1
    })
    expect(navigate).toHaveBeenCalledWith({ tryNo: 1 })
  })

  it("supports duplicate, rename, and delete operations", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(response(tryData(3)))
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce(response())
    vi.stubGlobal("fetch", request)
    const runtime = createSettingsRuntime({ caseNo: () => 9, navigate: vi.fn() })
    runtime.setCaseTries([tryData(1), tryData(2)])
    runtime.setCurrentTry(1)

    const duplicate = await runtime.duplicateTry(1)
    await runtime.renameTry(2, "Renamed")
    await runtime.deleteTry(2)

    expect(duplicate.tryNo).toBe(3)
    expect(request.mock.calls[0][0]).toBe("api/clone/cases/9/tries/1")
    expect(request.mock.calls[1][0]).toBe("api/cases/9/tries/2")
    expect(request.mock.calls[2][0]).toBe("api/cases/9/tries/2")
    expect(runtime.editable().tries.find(item => item.tryNo === 2).deleted).toBe(true)
  })

  it("saves a tuning draft, selects the new try, and returns it for controller navigation", async () => {
    const request = vi.fn().mockResolvedValue(response(tryData(5)))
    const navigate = vi.fn()
    const updated = vi.fn()
    document.addEventListener("case-settings:updated", updated)
    vi.stubGlobal("fetch", request)
    const runtime = createSettingsRuntime({ caseNo: () => 9, navigate })
    runtime.setCaseTries([tryData(1)])
    runtime.setCurrentTry(1)
    const settings = runtime.draft()
    settings.queryParams = "q=#$query##&bq=##zeta## ##alpha##"
    settings.searchEnginePreset = 42

    await runtime.save({ ...settings, inError: true })
    expect(request).not.toHaveBeenCalled()

    const savedTry = await runtime.save(settings)

    const [url, init] = request.mock.calls[0]
    expect(url).toBe("api/cases/9/tries")
    expect(init.method).toBe("POST")
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({
      parent_try_number: 1,
      try: { query_params: "q=#$query##&bq=##zeta## ##alpha##" },
      search_endpoint: {
        search_engine: "solr",
        endpoint_url: "https://search.example.test/select",
        mapper_based_search_engine_id: 42
      }
    })
    // New query-param variables default to 10; the stale `boost` is kept but sorted in.
    expect(Object.keys(body.curator_vars)).toEqual(["alpha", "boost", "zeta"])
    expect(body.curator_vars).toMatchObject({ alpha: 10, zeta: 10 })
    expect(runtime.applicable()).toBe(savedTry)
    expect(savedTry.tryNo).toBe(5)
    expect(updated).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
    document.removeEventListener("case-settings:updated", updated)
  })

  it("references an existing search endpoint instead of inlining one", async () => {
    const request = vi.fn().mockResolvedValue(response())
    vi.stubGlobal("fetch", request)
    const runtime = createSettingsRuntime({ caseNo: () => 9, tryNo: () => 1 })
    runtime.setCaseTries([{ ...tryData(1), search_endpoint_id: 3 }])
    runtime.setCurrentTry(1)

    await runtime.update(runtime.editable())

    const body = JSON.parse(request.mock.calls[0][1].body)
    expect(body.try.search_endpoint_id).toBe(3)
    expect(body).not.toHaveProperty("search_endpoint")
  })

  it("defaults null query params per engine and derives the header type", () => {
    const runtime = createSettingsRuntime()
    runtime.setCaseTries([
      { ...tryData(1), query_params: null },
      { ...tryData(2), search_engine: "es", query_params: null, custom_headers: { Authorization: "ApiKey abc" } },
      { ...tryData(3), custom_headers: { "X-Thing": "1" } }
    ])

    runtime.setCurrentTry(1)
    expect(runtime.editable()).toMatchObject({ queryParams: "", headerType: "None" })
    runtime.setCurrentTry(2)
    expect(runtime.editable()).toMatchObject({ queryParams: "{}", headerType: "API Key" })
    runtime.setCurrentTry(3)
    expect(runtime.editable().headerType).toBe("Custom")
  })

  it("moves to the last remaining try when the selected try is deleted, and never deletes the only try", async () => {
    const request = vi.fn().mockResolvedValue(response())
    const navigate = vi.fn()
    vi.stubGlobal("fetch", request)
    const runtime = createSettingsRuntime({ caseNo: () => 9, navigate })
    runtime.setCaseTries([tryData(1), tryData(2), tryData(3)])
    runtime.setCurrentTry(3)

    await runtime.deleteTry(3)
    expect(navigate).toHaveBeenCalledWith({ tryNo: 2 })

    runtime.setCaseTries([tryData(1)])
    await runtime.deleteTry(1)
    expect(request).toHaveBeenCalledOnce()
  })

  it("previews query arguments and rejects failed API responses", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(response({ args: { q: ["books"] } }))
      .mockResolvedValueOnce({ text: async function () { return JSON.stringify(await this.json()) || "" },  ok: false, status: 503, json: vi.fn(async () => null) })
    vi.stubGlobal("fetch", request)
    const runtime = createSettingsRuntime({ caseNo: () => 9 })

    await expect(runtime.previewArgs(1, "q=books")).resolves.toEqual({ q: ["books"] })
    await expect(runtime.previewArgs(1, "q=books")).rejects.toThrow("Request failed (503)")
  })
})
