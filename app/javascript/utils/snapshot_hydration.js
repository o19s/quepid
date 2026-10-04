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

export function registerAndHydrateSnapshots({
  snapshots,
  registry,
  settings,
  supportsLookupById,
  createFieldSpec,
  rootUrl,
  caseNo,
  addDocIds,
  addScopedDocIds,
  clearScopedDocs,
  updateDocs,
  createModel,
  getDoc,
  explainDoc,
  formatDate,
  log
}) {
  const snapshotDocIds = []
  const useSnapshotScopedCache =
    settings &&
    Object.keys(settings).length > 0 &&
    (settings.searchEngine === "static" || supportsLookupById(settings.searchEngine) === false)

  const models = registerSnapshotModels({
    snapshots,
    registry,
    addDocIds: (ids) => snapshotDocIds.push(ids),
    createModel,
    getDoc,
    explainDoc,
    formatDate,
    log
  })

  if (!settings || Object.keys(settings).length === 0) {
    return { models, promise: Promise.resolve() }
  }

  if (useSnapshotScopedCache && snapshots.length > 0) {
    const promise = snapshots.reduce(
      (chain, snapshot, index) =>
        chain.then(() => {
          clearScopedDocs(snapshot.id)
          addScopedDocIds(snapshotDocIds[index], snapshot.id)
          const snapshotSettings = buildSnapshotLookupSettings({
            settings,
            supportsLookupById,
            createFieldSpec,
            rootUrl,
            caseNo,
            snapshotId: snapshot.id
          })
          return updateDocs(snapshotSettings, snapshot.id)
        }),
      Promise.resolve()
    )

    return { models, promise }
  }

  snapshotDocIds.forEach((ids) => addDocIds(ids))
  return { models, promise: updateDocs(settings) }
}

export function mapFieldSpecToSolrFormat(fieldSpec) {
  return fieldSpec.replace(/id:_([^,]+)/, "id:$1")
}
