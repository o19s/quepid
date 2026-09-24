/**
 * Framework-free helpers extracted from Angular's queriesSvc.
 *
 * These functions deliberately know nothing about Angular, $q, or the case
 * workspace. They are shared through quepidSearch while queriesSvc remains the
 * owner of the live Query objects during the migration.
 */

export function settingsWithTryOverrides(settings, tryOverrides) {
  return {
    ...settings,
    selectedTry: {
      ...settings.selectedTry,
      ...tryOverrides
    }
  }
}

const MAPPER_FUNCTION_NAMES = [
  "numberOfResultsMapper",
  "docsMapper",
  "nextPageArgsMapper",
  "ratedDocsQueryParamsMapper"
]

/**
 * Evaluate a mapper-code string once per cache key and return only the mapper
 * functions that Quepid recognizes. The explicit global object keeps this
 * utility testable without relying on the browser global.
 */
export function evaluateMapperFunctions(mapperCode, cache = {}, globalObject = window) {
  if (Object.hasOwn(cache, mapperCode)) return cache[mapperCode]

  MAPPER_FUNCTION_NAMES.forEach((name) => {
    delete globalObject[name]
  })

  // Mapper code is user-provided JavaScript by design; this preserves the
  // existing Angular behavior while moving the seam out of the service.
  const mapperFunction = new Function(mapperCode)
  mapperFunction.call(globalObject)

  const functions = Object.fromEntries(
    MAPPER_FUNCTION_NAMES.map((name) => [
      name,
      typeof globalObject[name] === "function" ? globalObject[name] : undefined
    ])
  )
  cache[mapperCode] = functions
  return functions
}

export function matchFeaturesExplain(doc) {
  const matchFeatures = doc?.matchfeatures
  if (!matchFeatures || Object.keys(matchFeatures).length === 0) return undefined

  return {
    description: "sum of matched fields:",
    value: doc.fields ? doc.fields.score : undefined,
    details: Object.keys(matchFeatures).map((fieldName) => ({
      description: fieldName,
      value: matchFeatures[fieldName],
      details: []
    }))
  }
}

export async function pAll(queue, requestsPerMinute) {
  const results = []

  if (requestsPerMinute && requestsPerMinute > 0) {
    const minDelayMs = 60000 / requestsPerMinute

    for (let index = 0; index < queue.length; index++) {
      if (index > 0) await new Promise((resolve) => setTimeout(resolve, minDelayMs))
      const promise = queue[index]()
      await promise
      results[index] = promise
    }

    return Promise.all(results)
  }

  const concurrency = 10
  let index = 0
  const worker = async () => {
    while (index < queue.length) {
      const currentIndex = index++
      const promise = queue[currentIndex]()
      await promise
      results[currentIndex] = promise
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker))
  return Promise.all(results)
}
