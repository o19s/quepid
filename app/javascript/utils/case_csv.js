/**
 * CSV builders for the core case toolbar's "Export" modal (general and
 * snapshot formats). Ported from the AngularJS `caseCSVSvc.stringify` /
 * `stringifySnapshot` it replaces — see
 * `spec/javascripts/angular/services/caseCSVSvc_spec.js` (Karma) for the
 * escaping edge cases this preserves, now covered by this file's Vitest spec.
 *
 * The "detailed" format is intentionally not ported here — it needs the
 * live, already-searched documents held in the still-running Angular
 * `queriesSvc`, not data the server can reconstruct. See
 * `export_case_core_controller.js` and `caseCSVSvc.js`.
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
    data = data.trim().replace(/"/g, '""')

    if (data.includes(",") || data.includes("\n") || data.includes("\r")) {
      data = TEXT_DELIMITER + data + TEXT_DELIMITER
    }

    if (LEADING_CHARS_NEEDING_ESCAPE.includes(data[0])) {
      data = ` ${data}`
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

// Matches AngularJS SnapshotFactory's `snapshotName()`: "($filter('date')(time, 'shortDate')) name"
export function formatShortDate(dateString) {
  const date = new Date(dateString)
  const year = String(date.getFullYear()).slice(-2)
  return `${date.getMonth() + 1}/${date.getDate()}/${year}`
}

/**
 * "General" export format: one row per scored query, mirroring the AngularJS
 * `caseCSVSvc.stringify(aCase, queriesSvc.queries, true)`.
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
 * "Snapshot" export format, mirroring the AngularJS
 * `caseCSVSvc.stringifySnapshot(aCase, snapshot, true)`.
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
