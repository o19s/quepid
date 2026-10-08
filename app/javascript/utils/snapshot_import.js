import { postJson } from "api/json"

function snapshotTime(value, rowNumber) {
  // Static wizard CSVs omit this column and retain the server's default time.
  if (value == null) return value
  const text = String(value).trim()
  const legacy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4}) (\d{1,2}):(\d{2})$/)
  const iso = text.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/
  )
  const invalid = () => {
    throw new Error(
      `Row ${rowNumber}: invalid Snapshot Time "${value}". Use ISO 8601 or MM/DD/YY HH:MM (20YY).`
    )
  }
  if (!legacy && !iso) return invalid()
  const year = legacy ? Number(legacy[3]) + (legacy[3].length === 2 ? 2000 : 0) : Number(iso[1])
  const month = Number(legacy ? legacy[1] : iso[2])
  const day = Number(legacy ? legacy[2] : iso[3])
  const hour = Number((legacy || iso)[4] || 0)
  const minute = Number((legacy || iso)[5] || 0)
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1] || hour > 23 || minute > 59) {
    return invalid()
  }
  if (iso) {
    if (Number.isNaN(Date.parse(text))) return invalid()
    return text
  }
  // Keep wall-clock time; adding Z or converting in the browser would shift it.
  const pad = (number) => String(number).padStart(2, "0")
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00`
}

export function buildSnapshotImportGroups(rows, targetCaseId, { includeFields = true } = {}) {
  const cases = Object.create(null)

  rows.forEach((doc, index) => {
    const createdAt = snapshotTime(doc["Snapshot Time"], index + 2)
    const caseId = targetCaseId ?? doc["Case ID"]
    cases[caseId] ||= { snapshots: Object.create(null) }

    const snapshotName = doc["Snapshot Name"]
    cases[caseId].snapshots[snapshotName] ||= {
      queries: Object.create(null),
      created_at: createdAt,
      name: snapshotName
    }

    const snapshot = cases[caseId].snapshots[snapshotName]
    const queryText = doc["Query Text"]
    snapshot.queries[queryText] ||= { docs: [] }
    const document = {
      id: doc["Doc ID"],
      position: doc["Doc Position"]
    }
    if (includeFields) {
      document.fields = Object.fromEntries(
        Object.entries(doc).filter(
          ([key]) =>
            ![
              "Doc ID",
              "Doc Position",
              "Snapshot Name",
              "Snapshot Time",
              "Case ID",
              "Query Text"
            ].includes(key)
        )
      )
    }
    snapshot.queries[queryText].docs.push(document)
  })

  return cases
}

export async function importSnapshotsToCase(rows, targetCaseId, rootUrl) {
  const groups = buildSnapshotImportGroups(rows, targetCaseId)
  const imported = []

  for (const [caseId, caseData] of Object.entries(groups)) {
    for (const snapshot of Object.values(caseData.snapshots)) {
      const payload = await postJson(`${rootUrl}/api/cases/${caseId}/snapshots/imports`, {
        snapshots: [snapshot]
      })
      imported.push(...(payload.snapshots || []))
    }
  }

  return imported
}
