/** Build the Solr-compatible settings used to hydrate recorded snapshot docs. */
export function buildSnapshotLookupSettings({
  settings,
  supportsLookupById,
  createFieldSpec,
  rootUrl,
  caseNo,
  snapshotId
}) {
  if (!settings || Object.keys(settings).length === 0) return settings
  if (settings.searchEngine !== "static" && supportsLookupById(settings.searchEngine) !== false) {
    return settings
  }

  const settingsForLookup = { ...settings }
  settingsForLookup.apiMethod = "GET"
  settingsForLookup.searchEngine = "solr"
  settingsForLookup.fieldSpec = createFieldSpec(mapFieldSpecToSolrFormat(settings.fieldSpec))
  settingsForLookup.searchEndpointId = null
  settingsForLookup.customHeaders = null
  settingsForLookup.searchUrl = `${rootUrl}/api/cases/${caseNo}/snapshots/${snapshotId}/search`
  return settingsForLookup
}

export function registerSnapshotModels({
  snapshots,
  registry,
  addDocIds,
  createModel,
  getDoc,
  explainDoc,
  formatDate,
  log
}) {
  const models = snapshots.map((params) =>
    createModel({
      params,
      getDoc,
      explainDoc,
      formatDate,
      log
    })
  )

  models.forEach((model, index) => {
    registry[snapshots[index].id] = model
    addDocIds(model.allDocIds())
  })

  return models
}

export function mapFieldSpecToSolrFormat(fieldSpec) {
  return fieldSpec.replace(/id:_([^,]+)/, "id:$1")
}
