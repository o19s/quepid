// Runs scorer code for a single query — port of Angular ScorerFactory.runCode()
// and lib/scorer_logic.js helper functions to plain ES module.
//
// The scorer code is user-defined JavaScript that calls helper functions
// (eachDoc, docRating, setScore, etc.) and ultimately calls setScore(value).
// We run the code via new Function() with helpers injected as parameters.

const DEFAULT_NUM_DOCS = 10

/**
 * Execute scorer code for a single query.
 *
 * @param {string} code - The scorer JavaScript code (e.g. AP@10, nDCG@10)
 * @param {number[]} scale - The scorer scale array (e.g. [0,1,2,3])
 * @param {Array} docs - Search result docs, each with { id, ... } from search results
 * @param {Object} ratings - { docId: ratingValue } for this query
 * @param {number} numFound - Total results from search engine
 * @param {Array} bestDocs - All rated docs as [{ docId, rating }] sorted by rating desc
 * @param {Object} [options] - Optional query-level options
 * @returns {{ score: number|string|null, depthOfRating: number|null }}
 *   The computed score, or "--" / "zsr" / null, plus depthOfRating if scorer defines `k`
 */
export function runScorerCode(code, scale, docs, ratings, numFound, bestDocs, options) {
  if (!code) return { score: null, depthOfRating: null }

  const maxScaleValue = scale.length > 0 ? parseInt(scale[scale.length - 1], 10) : 0

  // Build doc wrappers that match what scorer code expects
  const wrappedDocs = docs.map((doc) => {
    const docId = String(doc.id)
    const rating = ratings[docId]
    return {
      doc: doc,
      getRating() {
        return rating !== undefined ? parseInt(rating, 10) : undefined
      },
      hasRating() {
        return rating !== undefined
      },
    }
  })

  // Build bestDocs wrappers (all rated docs, not just those in search results)
  const wrappedBestDocs = bestDocs.map((bd) => ({
    docId: bd.docId,
    rating: parseInt(bd.rating, 10),
    getRating() {
      return parseInt(bd.rating, 10)
    },
    hasRating() {
      return true
    },
  }))

  // Build the query object that some scorers reference
  const query = {
    ratedDocs: wrappedBestDocs,
  }

  let theScore = null
  let theDepthOfRating = null

  // --- Helper functions available to scorer code ---

  const setScore = (score) => {
    theScore = score
  }

  const recordDepthOfRanking = (k) => {
    theDepthOfRating = k
  }

  const docAt = (posn) => {
    if (posn >= wrappedDocs.length) return {}
    return wrappedDocs[posn].doc
  }

  const docExistsAt = (posn) => posn < wrappedDocs.length

  const ratedDocAt = (posn) => {
    if (posn >= wrappedBestDocs.length) return {}
    return wrappedBestDocs[posn]
  }

  const ratedDocExistsAt = (posn) => posn < wrappedBestDocs.length

  const hasDocRating = (posn) => docExistsAt(posn) && wrappedDocs[posn].hasRating()

  const docRating = (posn) => {
    if (docExistsAt(posn)) return wrappedDocs[posn].getRating()
    return undefined
  }

  const numFoundFn = () => numFound

  const numReturned = () => wrappedDocs.length

  const baseAvg = (docList, count) => {
    if (count === undefined) count = DEFAULT_NUM_DOCS
    if (count > docList.length) count = docList.length

    let sum = 0
    let docsRated = 0
    for (let i = 0; i < count; i++) {
      if (docList[i].hasRating()) {
        sum += parseInt(docList[i].getRating(), 10)
        docsRated++
      }
    }
    return docsRated > 0 ? sum / docsRated : null
  }

  const avgRating = (count) => baseAvg(wrappedDocs, count)

  const eachDoc = (f, count) => {
    if (count === undefined) count = DEFAULT_NUM_DOCS
    for (let i = 0; i < count; i++) {
      if (docExistsAt(i)) f(docAt(i), i)
    }
  }

  const eachRatedDoc = (f, count) => {
    if (count === undefined) count = DEFAULT_NUM_DOCS
    for (let i = 0; i < count; i++) {
      if (ratedDocExistsAt(i)) f(ratedDocAt(i), i)
    }
  }

  const eachDocWithRating = (f) => {
    for (let i = 0; i < wrappedBestDocs.length; i++) {
      f(wrappedBestDocs[i])
    }
  }

  const eachDocWithRatingEqualTo = (score, f) => {
    for (let i = 0; i < wrappedBestDocs.length; i++) {
      if (wrappedBestDocs[i].rating === score) f(wrappedBestDocs[i])
    }
  }

  const getBestRatings = (count, bdocs) => {
    return bdocs.slice(0, count).map((x) => x.rating)
  }

  const topRatings = (count) => getBestRatings(count, wrappedBestDocs)

  const qOption = (key) => {
    if (
      options !== undefined &&
      options !== null &&
      Object.prototype.hasOwnProperty.call(options, key)
    ) {
      return options[key]
    }
    return null
  }

  // pass/fail for unit-test-style scorers
  const pass = () => {
    theScore = 100
  }
  const fail = () => {
    theScore = 0
  }
  const assert = (cond) => {
    if (!cond) fail()
  }
  const assertOrScore = (cond, s) => {
    if (!cond) {
      theScore = s
    }
  }

  // Suppress lint warnings about unused vars — they ARE used by eval'd scorer code
  // Build a function that has all helpers in scope.
  // Append k-detection code matching Angular's ScorerFactory pattern:
  // if the scorer code defines a variable `k`, capture it as depthOfRating.
  const codeWithKDetection = code + "\n;if (typeof k !== 'undefined') { recordDepthOfRanking(k); }"

  const scorerFn = new Function(
    "setScore",
    "recordDepthOfRanking",
    "docAt",
    "docExistsAt",
    "ratedDocAt",
    "ratedDocExistsAt",
    "hasDocRating",
    "docRating",
    "numFound",
    "numReturned",
    "baseAvg",
    "avgRating",
    "eachDoc",
    "eachRatedDoc",
    "eachDocWithRating",
    "eachDocWithRatingEqualTo",
    "getBestRatings",
    "topRatings",
    "qOption",
    "pass",
    "fail",
    "assert",
    "assertOrScore",
    "docs",
    "bestDocs",
    "query",
    "total",
    "options",
    codeWithKDetection,
  )

  try {
    scorerFn(
      setScore,
      recordDepthOfRanking,
      docAt,
      docExistsAt,
      ratedDocAt,
      ratedDocExistsAt,
      hasDocRating,
      docRating,
      numFoundFn,
      numReturned,
      baseAvg,
      avgRating,
      eachDoc,
      eachRatedDoc,
      eachDocWithRating,
      eachDocWithRatingEqualTo,
      getBestRatings,
      topRatings,
      qOption,
      pass,
      fail,
      assert,
      assertOrScore,
      wrappedDocs,
      wrappedBestDocs,
      query,
      numFound,
      options,
    )
  } catch (e) {
    console.error("Scorer execution error:", e)
    return { score: null, depthOfRating: null }
  }

  // Post-process the score (matches ScorerFactory.score() logic)
  let finalScore = null
  if (theScore === null) {
    if (wrappedDocs.length === 0) finalScore = "zsr"
    else if (wrappedBestDocs.length === 0) finalScore = "--"
    else finalScore = null
  } else if (typeof theScore === "number") {
    if (theScore < 0) finalScore = 0
    else if (theScore > maxScaleValue && maxScaleValue > 0) finalScore = maxScaleValue
    else if (maxScaleValue === 0) finalScore = 0
    else finalScore = theScore
  }

  return { score: finalScore, depthOfRating: theDepthOfRating }
}

/**
 * Compute case-level score as the average of all query scores that are numeric.
 *
 * @param {Object} queryScores - { queryId: { score, maxScore, numFound, text } }
 * @returns {{ score: number|null, allRated: boolean }}
 */
export function computeCaseScore(queryScores) {
  const entries = Object.values(queryScores)
  if (entries.length === 0) return { score: null, allRated: false }

  let sum = 0
  let count = 0
  let allRated = true

  for (const qs of entries) {
    if (typeof qs.score === "number") {
      sum += qs.score
      count++
    } else {
      allRated = false
    }
  }

  if (count === 0) return { score: null, allRated: false }

  return {
    score: sum / count,
    allRated,
  }
}
