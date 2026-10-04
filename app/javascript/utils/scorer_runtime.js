const DEFAULT_NUM_DOCS = 10

const copyValue = (value) => {
  if (value === null || typeof value !== "object") return value
  if (Array.isArray(value)) return value.map(copyValue)
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, copyValue(entry)]))
}

/**
 * The one scorer implementation, shared by the case UI (via scorer_catalog.js)
 * and the server (lib/javascript_scorer.rb evaluates this file in MiniRacer).
 * Keep it a dependency-free ES module whose only export is createScorer, and
 * never use browser globals: the server strips `export` and runs it as-is.
 *
 * Input is scorer API JSON (snake_case: code, scale, scale_with_labels,
 * show_scale_labels, name, scorer_id, communal, owner_*, teams).
 *
 * What callers may rely on:
 *   score(query, total, docs, bestDocs, options) -> Promise of a number,
 *     "zsr" (no results), "--" (no ratings) or null (error in scorer.error).
 *     docs: [{ doc, hasRating(), getRating() }]; bestDocs: [{ id, rating }];
 *     query: { queryId, ratedDocs }.
 *   checkCode()            -> Promise rejecting with a message on bad code.
 *   getColors(), showScaleLabel(value), teamNames() for rating UIs.
 *   Fields: scorerId, name, displayName, code, scale, scaleWithLabels,
 *     showScaleLabels, colors, communal, owned, ownerId, ownerName, teams,
 *     error, depthOfRating.
 * The remaining helpers are runtime internals exposed for tests.
 */
export function createScorer(
  data = {},
  { promiseApi = Promise, schedule, refreshRatedDocs = () => undefined } = {}
) {
  const promises = promiseApi
  const scorer = {}
  const source = { ...data }

  if (source.scale === undefined) {
    source.scale = ["0", "1"]
    source.scaleWithLabels = scaleToScaleWithLabels(source.scale, null)
  }

  scorer.code = source.code
  scorer.showScaleLabels = source.show_scale_labels || false
  scorer.scaleWithLabels = source.scale_with_labels
  scorer.scale = source.scale
  scorer.error = false
  scorer.name = source.name
  scorer.displayName = source.communal === true ? `${source.name} (Communal)` : source.name
  scorer.owned = source.owned
  scorer.ownerId = source.owner_id
  scorer.ownerName = source.owner_name
  scorer.scorerId = source.scorer_id
  scorer.communal = source.communal
  scorer.teams = source.teams || []
  scorer.colors = scaleToColors(scorer.scale)

  function getColors() {
    return scaleToColors(scorer.scale)
  }

  function scaleToArray(string) {
    return string
      .trim()
      .split(/\s*,\s*/)
      .map((item) => parseInt(item, 10))
  }

  function scaleToColors(scale) {
    const colorMap = {}
    if (scale === undefined || scale.length === 0) return colorMap
    const values = typeof scale === "string" ? scaleToArray(scale) : scale
    const min = values[0]
    const max = values[values.length - 1]
    const range = max - min

    values.forEach((number) => {
      let hue = ((number - min) * 120) / range
      if (Number.isNaN(hue)) hue = 0
      colorMap[number] = { color: `hsl(${hue}, 100%, 50%)` }
      if (scorer.showScaleLabels && scorer.scaleWithLabels !== null) {
        colorMap[number].showScaleLabels = true
        colorMap[number].label = scorer.scaleWithLabels[number]
      }
    })
    return colorMap
  }

  function scaleToScaleWithLabels(scale, scaleWithLabels) {
    const labels = scaleWithLabels === undefined || scaleWithLabels === null ? {} : scaleWithLabels
    const values = typeof scale === "string" ? scale.split(/,\s*/) : scale
    ;(values || []).forEach((value) => {
      if (value.length >= 1 && (labels[value] === undefined || labels[value] === null)) {
        labels[value] = ""
      }
    })
    return labels
  }

  function showScaleLabel(value) {
    return (
      scorer.showScaleLabels === true &&
      scorer.scaleWithLabels !== null &&
      scorer.scaleWithLabels !== undefined &&
      scorer.scaleWithLabels[value] !== undefined
    )
  }

  function teamNames() {
    return scorer.teamName || scorer.teams.map((team) => team.name).join(", ")
  }

  function baseAvg(docs, count = DEFAULT_NUM_DOCS) {
    const limit = Math.min(count, docs.length)
    let sum = 0
    let docsRated = 0
    for (let index = 0; index < limit; index += 1) {
      if (docs[index].hasRating()) {
        sum += parseInt(docs[index].getRating(), 10)
        docsRated += 1
      }
    }
    return docsRated > 0 ? sum / docsRated : null
  }

  function baseAvgRounded(docs, count) {
    return Math.floor(baseAvg(docs, count))
  }

  function avg100(docs, count) {
    const max = scorer.scale[scorer.scale.length - 1]
    const avg = baseAvg(docs, count)
    return avg ? Math.floor(avg * (100 / max)) : null
  }

  function editDistance(first, second) {
    const matrix = Array.from({ length: first.length }, () => Array(second.length).fill(0))
    const get = (row, column) =>
      row < 0 || column < 0 || matrix.length === 0 ? 0 : matrix[row][column]
    for (let row = 0; row < first.length; row += 1) {
      for (let column = 0; column < second.length; column += 1) {
        const cost = first[row] === second[column] ? 0 : 1
        matrix[row][column] = Math.min(
          get(row - 1, column) + 1,
          get(row, column - 1) + 1,
          get(row - 1, column - 1) + cost
        )
      }
    }
    return get(first.length - 1, second.length - 1)
  }

  function getBestRatings(count, bestDocs) {
    return bestDocs.slice(0, count).map((doc) => doc.rating)
  }

  function distanceFromBest(docs, bestDocs, count = DEFAULT_NUM_DOCS) {
    const docCount = Math.min(count, docs.length)
    const bestCount = Math.min(count, bestDocs.length)
    const ratings = docs
      .slice(0, docCount)
      .map((doc) => (doc.hasRating() ? parseInt(doc.getRating(), 10) : null))
    const bestRatings = bestDocs.slice(0, bestCount).map((doc) => doc.rating)
    while (bestRatings.length < docCount) bestRatings.push(null)
    return Math.floor(editDistance(ratings, bestRatings))
  }

  function hasLoop() {
    const matches = (scorer.code || "").match(/(while|for)\s*\(/g)
    return matches
      ? promises.reject("Loops are currently not supported, use `eachDoc` to loop over documents.")
      : promises.resolve("Passes the loop test.")
  }

  function checkCode() {
    return hasLoop().then(() => "Code passes.")
  }

  function runCode(query, total, originalDocs, originalBestDocs, mode, options) {
    const max = scorer.scale[scorer.scale.length - 1]
    let resolveScore
    let rejectScore
    const scorePromise = new Promise((resolve, reject) => {
      resolveScore = resolve
      rejectScore = reject
    })
    const bestDocs = originalBestDocs || []
    bestDocs.forEach((doc) => {
      if (typeof doc.getRating !== "function") doc.getRating = () => doc.rating
    })

    let docs = originalDocs || []
    if (mode !== undefined) {
      docs = docs.map((doc) => {
        const copy = copyValue(doc)
        copy.getRating = () => (mode === "max" ? max : undefined)
        return copy
      })
    }

    const docAt = (position) => (position >= docs.length ? {} : docs[position].doc)
    const docExistsAt = (position) => position < docs.length
    const ratedDocAt = (position) =>
      position >= query.ratedDocs.length ? {} : query.ratedDocs[position]
    const ratedDocExistsAt = (position) => position < query.ratedDocs.length
    const hasDocRating = (position) => docExistsAt(position) && docs[position].hasRating()
    const docRating = (position) => (docExistsAt(position) ? docs[position].getRating() : undefined)
    const numFound = () => total
    const numReturned = () => docs.length
    const avgRating = (count) => baseAvg(docs, count)
    const avgRating100 = (count) => avg100(docs, count)
    const editDistanceFromBest = (count) => distanceFromBest(docs, bestDocs, count)
    const eachDoc = (callback, count = DEFAULT_NUM_DOCS) => {
      for (let index = 0; index < count; index += 1)
        if (docExistsAt(index)) callback(docAt(index), index)
    }
    const eachRatedDoc = (callback, count = DEFAULT_NUM_DOCS) => {
      for (let index = 0; index < count; index += 1)
        if (ratedDocExistsAt(index)) callback(ratedDocAt(index), index)
    }
    const refreshQueryRatedDocs = (count) => refreshRatedDocs(query.queryId, count)
    const eachDocWithRatingEqualTo = (rating, callback) =>
      bestDocs.forEach((doc) => {
        if (doc.rating === rating) callback(doc)
      })
    const eachDocWithRating = (callback) => bestDocs.forEach(callback)
    const topRatings = (count) => getBestRatings(count, bestDocs)
    const qOption = (key) =>
      options && Object.prototype.hasOwnProperty.call(options, key) ? options[key] : null
    const recordDepthOfRanking = (count) => {
      query.depthOfRating = count
      scorer.depthOfRating = count
    }
    const pass = () => resolveScore(100)
    const fail = () => rejectScore(0)
    const setScore = (score) => resolveScore(score)
    const assert = (condition) => {
      if (!condition) fail()
    }
    const assertOrScore = (condition, score) => {
      if (!condition) setScore(score)
    }

    if (mode === "max" && (scorer.code || "").includes("pass()")) return 100
    const code = `${scorer.code || ""}\nif (typeof k !== 'undefined') { recordDepthOfRanking(k) }`
    const names = [
      "query",
      "total",
      "docs",
      "bestDocs",
      "mode",
      "options",
      "max",
      "docAt",
      "docExistsAt",
      "ratedDocAt",
      "ratedDocExistsAt",
      "hasDocRating",
      "docRating",
      "numFound",
      "numReturned",
      "avgRating",
      "avgRating100",
      "editDistanceFromBest",
      "eachDoc",
      "eachRatedDoc",
      "refreshRatedDocs",
      "eachDocWithRatingEqualTo",
      "eachDocWithRating",
      "topRatings",
      "qOption",
      "recordDepthOfRanking",
      "pass",
      "fail",
      "setScore",
      "assert",
      "assertOrScore"
    ]
    const values = [
      query,
      total,
      docs,
      bestDocs,
      mode,
      options,
      max,
      docAt,
      docExistsAt,
      ratedDocAt,
      ratedDocExistsAt,
      hasDocRating,
      docRating,
      numFound,
      numReturned,
      avgRating,
      avgRating100,
      editDistanceFromBest,
      eachDoc,
      eachRatedDoc,
      refreshQueryRatedDocs,
      eachDocWithRatingEqualTo,
      eachDocWithRating,
      topRatings,
      qOption,
      recordDepthOfRanking,
      pass,
      fail,
      setScore,
      assert,
      assertOrScore
    ]

    const execute = () => {
      try {
        // Wrap in a block so scorer declarations (e.g. `const max`) shadow the
        // helper parameters instead of colliding with them.
        new Function(...names, `{\n${code}\n}`)(...values)
      } catch (error) {
        rejectScore(error)
      }
    }
    if (schedule) schedule(execute)
    else if (typeof queueMicrotask === "function") queueMicrotask(execute)
    else execute()
    return scorePromise
  }

  // Always undefined, as in the legacy ScorerFactory. Scores are not bounded
  // by the rating scale (CG@10 on a 0-3 scale can reach 30), so callers must
  // not treat this as a score ceiling; query scoring falls back to 1.
  function maxScore() {
    return scorer.scale[-1]
  }

  function score(query, total, docs, bestDocs, options) {
    bestDocs = bestDocs || []
    return scorer.runCode(query, total, docs, bestDocs, undefined, options).then(
      (calculated) => {
        if (calculated === null) {
          if (docs.length === 0) return "zsr"
          if (bestDocs.length === 0) return "--"
        }
        if (typeof calculated === "number") {
          if (calculated < 0) return 0
          return calculated
        }
        scorer.error = calculated
        return null
      },
      (error) => {
        scorer.error = error
        return null
      }
    )
  }

  Object.assign(scorer, {
    avg100,
    baseAvg,
    baseAvgRounded,
    checkCode,
    distanceFromBest,
    editDistance,
    getBestRatings,
    getColors,
    hasLoop,
    maxScore,
    runCode,
    scaleToArray,
    scaleToColors,
    scaleToScaleWithLabels,
    score,
    showScaleLabel,
    teamNames
  })
  return scorer
}
