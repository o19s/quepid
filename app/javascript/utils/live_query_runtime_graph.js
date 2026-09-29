/**
 * Compose the live-query runtime graph from focused runtime modules.
 *
 * The search service graph supplies environment callbacks, but this module
 * owns the wiring between query model, factory, documents, and execution.
 */
export function createLiveQueryRuntimeGraph({
  model,
  factory,
  documents,
  execution,
  factoryOptions,
  executionOptions
}) {
  const modelRuntime = model.create({
    ...factoryOptions.model,
    publish: factoryOptions.publish
  })
  const documentRuntime = documents.create({
    ...factoryOptions.documents,
    publish: factoryOptions.publish
  })
  const executionRuntime = execution.create({
    ...executionOptions,
    errors: {
      ...executionOptions.errors,
      onError: documentRuntime.setError
    },
    documents: {
      ...executionOptions.documents,
      createList: factoryOptions.documents.createDocList,
      setDocs: documentRuntime.setDocs,
      onError: documentRuntime.setError,
      matchFeaturesExplain: factoryOptions.documents.matchFeaturesExplain
    }
  })
  const factoryRuntime = factory.create({
    ...factoryOptions.factory,
    createModel: (options) => modelRuntime.create(options),
    publish: factoryOptions.publish
  })

  return {
    model: modelRuntime,
    documents: documentRuntime,
    execution: executionRuntime,
    factory: factoryRuntime
  }
}
