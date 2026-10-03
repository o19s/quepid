/**
 * CSV builders for the core case toolbar's "Export" modal.
 *
 * Detailed export also uses the live document read model. The search results
 * are already published into `queryDocumentsStore`.
 */

const EOL = "\r\n"
const TEXT_DELIMITER = '"'
const LEADING_CHARS_NEEDING_ESCAPE = ["=", "@", "+", "-"]

function escapeJsonStringForCsv(input) {
  if (typeof input === "string") {
    return `"${input.replace(/"/g, '""')}"`
  }
  return input
}

export function csvField(value) {
  let data = value

  if (typeof data === "object") {
    data = data === null ? "" : escapeJsonStringForCsv(JSON.stringify(data))
  } else if (typeof data === "string") {
    data = data.trim()

    // Neutralize spreadsheet formulas before adding CSV quoting. Otherwise a
    // value such as =HYPERLINK("...", "...") starts with a quote after
    // escaping and bypasses this check.
    if (LEADING_CHARS_NEEDING_ESCAPE.includes(data[0])) {
      data = ` ${data}`
    }

    data = data.replace(/"/g, '""')

    if (data.includes(",") || data.includes("\n") || data.includes("\r") || data.includes('"')) {
      data = TEXT_DELIMITER + data + TEXT_DELIMITER
    }
  }

  return data
}

function csvRow(fields) {
  return fields.map(csvField).join(",") + EOL
}

export function formatDownloadFileName(fileName) {
  return fileName.replace(/ /g, "_").replace(/:/g, "_")
}

function mergeFieldNames(existing, names) {
  const merged = [...existing]
  names.forEach((name) => {
    if (!merged.includes(name)) merged.push(name)
  })
  return merged
}

// Snapshot display dates use the short month/day/year format.
export function formatShortDate(dateString) {
  const date = new Date(dateString)
  const year = String(date.getFullYear()).slice(-2)
  return `${date.getMonth() + 1}/${date.getDate()}/${year}`
}

/**
 * "General" export format: one row per scored query.
 *
 * @param {object} caseData - `GET api/cases/:id?shallow=false` response
 * @param {object[]} queries - `GET api/cases/:id/queries` response's `queries` array
 */
export function buildGeneralCaseCsv(caseData, queries) {
  const header = [
    "Team Name",
    "Case Name",
    "Case ID",
    "Query Text",
    "Score",
    "Date Last Scored",
    "Count",
    "Information Need",
    "Notes",
    "Options"
  ]
  let csv = csvRow(header)

  const lastScore = caseData.last_score
  if (!lastScore) return csv

  const teamNames = (caseData.teams || []).map((team) => team.name).join(", ")
  const queryById = new Map(queries.map((query) => [query.query_id, query]))

  Object.entries(lastScore.queries || {}).forEach(([id, data]) => {
    const query = queryById.get(parseInt(id, 10))
    const notes = query?.notes || null
    const informationNeed = query?.information_need || null
    const hasOptions = query?.options && Object.keys(query.options).length > 0
    const options = hasOptions ? query.options : null

    csv += csvRow([
      teamNames,
      caseData.case_name,
      caseData.case_id,
      data.text,
      data.score,
      lastScore.updated_at,
      data.numFound,
      informationNeed,
      notes,
      options
    ])
  })

  return csv
}

/**
 * Detailed export from the live document read model. The case endpoint
 * supplies metadata and last-score state; each query contains the plain
 * document snapshots published by queriesSvc.
 */
export function buildDetailedCaseCsv(caseData, queries) {
  const lastScore = caseData.last_score
  if (!lastScore) return ""

  const firstQuery = Object.values(queries)[0]
  if (!firstQuery) return ""

  const fieldSpec = firstQuery.fieldSpec || {}
  const idField = fieldSpec.id
  const titleField = fieldSpec.title
  const fields = (fieldSpec.fields || []).filter(
    (field) => field !== idField && field !== titleField
  )
  const header = [
    "Team Name",
    "Case Name",
    "Case ID",
    "Query Text",
    "Doc ID",
    "Doc Position",
    "Title",
    "Rating",
    ...fields
  ]
  const teamNames = (caseData.teams || []).map((team) => team.name).join(", ")
  const caseId = lastScore.case_id ?? caseData.case_id
  let csv = csvRow(header)

  Object.values(queries).forEach((query) => {
    const base = [teamNames, caseData.case_name, caseId, query.queryText]
    const docs = query.docs || []

    if (docs.length === 0) {
      csv += csvRow(base)
      return
    }

    docs.forEach((doc, index) => {
      csv += csvRow([
        ...base,
        doc.id,
        index + 1,
        doc.title,
        doc.rating,
        ...fields.map((field) => doc.rawFields?.[field])
      ])
    })
  })

  return csv
}

/**
 * "Snapshot" export format.
 *
 * @param {number|string} caseId
 * @param {object} snapshotData - `GET api/cases/:id/snapshots/:id?shallow=false` response
 */
export function buildSnapshotCsv(caseId, snapshotData) {
  const docsByQuery = snapshotData.docs || {}
  const snapshotName = `(${formatShortDate(snapshotData.time)}) ${snapshotData.name}`

  let fields = []
  Object.values(docsByQuery).forEach((docs) => {
    docs.forEach((doc) => {
      fields = mergeFieldNames(fields, Object.keys(doc.fields || {}))
    })
  })

  let csv = csvRow([
    "Snapshot Name",
    "Snapshot Time",
    "Case ID",
    "Query Text",
    "Doc ID",
    "Doc Position",
    ...fields
  ])

  Object.entries(docsByQuery).forEach(([queryId, docs]) => {
    const matchingQuery = (snapshotData.queries || []).find(
      (query) => query.query_id === parseInt(queryId, 10)
    )
    if (!matchingQuery?.query_text) return

    docs.forEach((doc, index) => {
      const fieldValues = fields.map((field) => doc.fields?.[field])
      csv += csvRow([
        snapshotName,
        snapshotData.time,
        caseId,
        matchingQuery.query_text,
        doc.id,
        index + 1,
        ...fieldValues
      ])
    })
  })

  return csv
}
