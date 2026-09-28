import { describe, expect, it, vi } from "vitest"
import { createSettingsRuntime } from "utils/settings_runtime"

const response = (data = {}, status = 200) => ({
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

  it("updates settings through the API and publishes the changed try", async () => {
    const request = vi.fn().mockResolvedValue(response())
    const navigate = vi.fn()
    const runtime = createSettingsRuntime({ request, caseNo: () => 9, tryNo: () => 1, navigate })
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
    const runtime = createSettingsRuntime({ request, caseNo: () => 9, navigate: vi.fn() })
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

  it("previews query arguments and rejects failed API responses", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(response({ args: { q: ["books"] } }))
      .mockResolvedValueOnce({ ok: false, status: 503, json: vi.fn() })
    const runtime = createSettingsRuntime({ request, caseNo: () => 9 })

    await expect(runtime.previewArgs(1, "q=books")).resolves.toEqual({ q: ["books"] })
    await expect(runtime.previewArgs(1, "q=books")).rejects.toThrow("Unable to preview query settings (503)")
  })
})
